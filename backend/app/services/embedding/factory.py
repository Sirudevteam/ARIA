"""
Embedding Provider Factory and Dynamic Registry.
Resolves the active embedding provider dynamically from settings without hardcoded dependencies.
"""

from typing import Dict, Optional, Type

from app.core.config import get_settings
from app.services.embedding.base import BaseEmbeddingProvider
from app.services.embedding.providers.bge_m3 import BGEM3EmbeddingProvider
from app.services.embedding.providers.mock import MockEmbeddingProvider
from app.services.embedding.providers.openai import OpenAIEmbeddingProvider

settings = get_settings()

# Provider class registry
_PROVIDER_REGISTRY: Dict[str, Type[BaseEmbeddingProvider]] = {
    "bge_m3": BGEM3EmbeddingProvider,
    "openai": OpenAIEmbeddingProvider,
    "mock": MockEmbeddingProvider,
}


def register_embedding_provider(name: str, provider_cls: Type[BaseEmbeddingProvider]) -> None:
    """Register a custom embedding provider at runtime."""
    _PROVIDER_REGISTRY[name.lower()] = provider_cls


def get_embedding_provider(
    provider_type: Optional[str] = None,
    model_name: Optional[str] = None,
    dimensions: Optional[int] = None,
) -> BaseEmbeddingProvider:
    """
    Factory function to retrieve the configured embedding provider.
    Defaults to settings.EMBEDDING_PROVIDER (BGE-M3 standard).
    """
    p_type = (provider_type or settings.EMBEDDING_PROVIDER).lower().strip()

    if p_type not in _PROVIDER_REGISTRY:
        # Fallback to BGE-M3 if unknown provider requested
        p_type = "bge_m3"

    provider_cls = _PROVIDER_REGISTRY[p_type]

    # Resolve model name and dimensions with provider-specific defaults
    if p_type == "bge_m3":
        return BGEM3EmbeddingProvider(
            model_name=model_name or "BAAI/bge-m3",
            dimensions=dimensions or 1024,
            max_retries=settings.EMBEDDING_MAX_RETRIES,
        )
    elif p_type == "openai":
        return OpenAIEmbeddingProvider(
            model_name=model_name or "text-embedding-3-small",
            dimensions=dimensions or 1536,
            max_retries=settings.EMBEDDING_MAX_RETRIES,
        )
    elif p_type == "mock":
        return MockEmbeddingProvider(
            model_name=model_name or "mock-embedding-v1",
            dimensions=dimensions or 1024,
        )

    return provider_cls()
