"""
LLM Provider Factory and Dynamic Registry.
Dynamically resolves active LLM provider (DeepSeek, OpenAI, Mock) from configuration.
"""

from typing import Dict, Optional, Type

from app.core.config import get_settings
from app.services.llm.base import BaseLLMProvider
from app.services.llm.providers.deepseek import DeepSeekProvider
from app.services.llm.providers.mock import MockLLMProvider
from app.services.llm.providers.openai import OpenAILLMProvider

settings = get_settings()

_LLM_REGISTRY: Dict[str, Type[BaseLLMProvider]] = {
    "deepseek": DeepSeekProvider,
    "openai": OpenAILLMProvider,
    "mock": MockLLMProvider,
}


def register_llm_provider(name: str, provider_cls: Type[BaseLLMProvider]) -> None:
    """Register a custom LLM provider class at runtime."""
    _LLM_REGISTRY[name.lower().strip()] = provider_cls


def get_llm_provider(
    provider_type: Optional[str] = None,
    model_name: Optional[str] = None,
) -> BaseLLMProvider:
    """
    Factory function to retrieve the configured LLM provider.
    Defaults to settings.LLM_PROVIDER (DeepSeek standard).
    """
    p_type = (provider_type or settings.LLM_PROVIDER or "deepseek").lower().strip()

    if p_type not in _LLM_REGISTRY:
        p_type = "deepseek"

    resolved_model = model_name or settings.LLM_MODEL

    if p_type == "deepseek":
        return DeepSeekProvider(
            model_name=resolved_model or "deepseek-chat",
            base_url=settings.DEEPSEEK_BASE_URL,
            timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
            max_retries=settings.LLM_MAX_RETRIES,
        )
    elif p_type == "openai":
        return OpenAILLMProvider(
            model_name=resolved_model or "gpt-4o-mini",
            timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
            max_retries=settings.LLM_MAX_RETRIES,
        )
    elif p_type == "mock":
        return MockLLMProvider(
            model_name=resolved_model or "mock-llm-v1",
        )

    provider_cls = _LLM_REGISTRY[p_type]
    return provider_cls()
