"""
OpenAI LLM Provider Implementation (gpt-4o, gpt-4o-mini).
"""

import json
import logging
import time
from typing import AsyncGenerator, List, Optional
import httpx

from app.core.config import get_settings
from app.schemas.llm import ChatMessage, LLMResponse, LLMStreamChunk, TokenUsage
from app.services.embedding.retry import with_retry
from app.services.llm.base import BaseLLMProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class OpenAILLMProvider(BaseLLMProvider):
    """
    OpenAI Chat API Provider.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = "gpt-4o-mini",
        timeout_seconds: Optional[int] = None,
        max_retries: Optional[int] = None,
    ):
        self._api_key = api_key or settings.OPENAI_API_KEY
        self._model_name = model_name or "gpt-4o-mini"
        self._timeout_seconds = timeout_seconds or settings.LLM_TIMEOUT_SECONDS or 60
        self._max_retries = max_retries or settings.LLM_MAX_RETRIES or 3
        self._endpoint = "https://api.openai.com/v1/chat/completions"

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model_name

    def _build_payload_messages(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
    ) -> List[dict]:
        payload_msgs = []
        if system_prompt:
            payload_msgs.append({"role": "system", "content": system_prompt})
        for msg in messages:
            payload_msgs.append({"role": msg.role, "content": msg.content})
        return payload_msgs

    async def generate(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        payload_msgs = self._build_payload_messages(messages, system_prompt)
        payload = {
            "model": self._model_name,
            "messages": payload_msgs,
            "temperature": temperature if temperature is not None else settings.LLM_TEMPERATURE,
            "max_tokens": max_tokens if max_tokens is not None else settings.LLM_MAX_TOKENS,
            "stream": False,
        }

        if not self._api_key:
            return LLMResponse(
                content="Simulated OpenAI response for testing.",
                model=f"simulated-{self._model_name}",
                usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
                latency_ms=10.0,
                finish_reason="stop",
            )

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        start_time = time.perf_counter()
        async with httpx.AsyncClient(timeout=float(self._timeout_seconds)) as client:
            resp = await client.post(self._endpoint, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        choice = data.get("choices", [{}])[0]
        content = choice.get("message", {}).get("content", "")
        raw_usage = data.get("usage", {})

        return LLMResponse(
            content=content,
            model=data.get("model", self._model_name),
            usage=TokenUsage(
                prompt_tokens=raw_usage.get("prompt_tokens", 0),
                completion_tokens=raw_usage.get("completion_tokens", 0),
                total_tokens=raw_usage.get("total_tokens", 0),
            ),
            latency_ms=latency_ms,
            finish_reason=choice.get("finish_reason", "stop"),
        )

    async def generate_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        payload_msgs = self._build_payload_messages(messages, system_prompt)
        payload = {
            "model": self._model_name,
            "messages": payload_msgs,
            "temperature": temperature if temperature is not None else settings.LLM_TEMPERATURE,
            "max_tokens": max_tokens if max_tokens is not None else settings.LLM_MAX_TOKENS,
            "stream": True,
        }

        if not self._api_key:
            words = "Simulated streaming OpenAI token stream.".split()
            for w in words:
                yield LLMStreamChunk(delta=f"{w} ", done=False)
            yield LLMStreamChunk(delta="", done=True, finish_reason="stop")
            return

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=float(self._timeout_seconds)) as client:
            async with client.stream("POST", self._endpoint, headers=headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        yield LLMStreamChunk(delta="", done=True, finish_reason="stop")
                        break
                    try:
                        chunk_data = json.loads(data_str)
                        delta_content = chunk_data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta_content:
                            yield LLMStreamChunk(delta=delta_content, done=False)
                    except json.JSONDecodeError:
                        continue
