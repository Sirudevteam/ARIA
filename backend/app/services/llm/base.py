"""
Abstract Base LLM Provider Interface.
Ensures the RAG system and chat controllers are completely decoupled from any single vendor.
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Optional

from app.schemas.llm import ChatMessage, LLMResponse, LLMStreamChunk


class BaseLLMProvider(ABC):
    """
    Abstract interface for Large Language Model providers (DeepSeek, OpenAI, Anthropic, Mock, etc.).
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Provider name identifier (e.g. 'deepseek', 'openai', 'mock')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Underlying LLM model identifier (e.g. 'deepseek-chat', 'deepseek-reasoner', 'gpt-4o')."""
        pass

    @abstractmethod
    async def generate(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> LLMResponse:
        """
        Generate a complete non-streaming response.
        """
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        """
        Generate streaming tokens via an async generator for Server-Sent Events (SSE).
        """
        pass

    def get_model_identifier(self) -> str:
        """Standardized model signature identifier."""
        return f"{self.provider_name}:{self.model_name}"
