"""
Mock LLM Provider for unit testing and offline development.
"""

from typing import AsyncGenerator, List, Optional

from app.schemas.llm import ChatMessage, LLMResponse, LLMStreamChunk, TokenUsage
from app.services.llm.base import BaseLLMProvider


class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic Mock LLM Provider for tests.
    """

    def __init__(self, model_name: str = "mock-llm-v1"):
        self._model_name = model_name

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def generate(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        last_user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "")
        answer = f"Mock response answering: '{last_user_msg}' with ISO 8855 compliance."
        return LLMResponse(
            content=answer,
            reasoning_content="Reasoned through coordinate frame definitions step by step.",
            model=self._model_name,
            usage=TokenUsage(prompt_tokens=25, completion_tokens=15, total_tokens=40),
            latency_ms=5.0,
            finish_reason="stop",
        )

    async def generate_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        tokens = ["Mock", "streaming", "answer", "token", "stream", "."]
        for t in tokens:
            yield LLMStreamChunk(delta=f"{t} ", done=False)

        yield LLMStreamChunk(
            delta="",
            done=True,
            usage=TokenUsage(prompt_tokens=25, completion_tokens=len(tokens), total_tokens=25 + len(tokens)),
            finish_reason="stop",
        )
