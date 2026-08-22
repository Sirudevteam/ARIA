"""
Reranker Provider Factory and Dynamic Registry.
Resolves the active reranker provider dynamically from settings without hardcoded dependencies.
"""

from typing import Dict, Optional, Type

from app.core.config import get_settings
from app.services.rag.reranker.base import BaseRerankerProvider
from app.services.rag.reranker.providers.bge_reranker import BGERerankerProvider
from app.services.rag.reranker.providers.cohere import CohereRerankerProvider
from app.services.rag.reranker.providers.local import LocalRerankerProvider

settings = get_settings()

_RERANKER_REGISTRY: Dict[str, Type[BaseRerankerProvider]] = {
    "bge_reranker": BGERerankerProvider,
    "cohere": CohereRerankerProvider,
    "local": LocalRerankerProvider,
}


def register_reranker_provider(name: str, provider_cls: Type[BaseRerankerProvider]) -> None:
    """Register a custom reranker provider at runtime."""
    _RERANKER_REGISTRY[name.lower()] = provider_cls


def get_reranker_provider(
    provider_type: Optional[str] = None,
    model_name: Optional[str] = None,
) -> BaseRerankerProvider:
    """
    Factory function to retrieve the configured reranker provider.
    Defaults to settings.RERANKER_PROVIDER (BGE-Reranker standard).
    """
    p_type = (provider_type or settings.RERANKER_PROVIDER).lower().strip()

    if p_type not in _RERANKER_REGISTRY:
        p_type = "bge_reranker"

    provider_cls = _RERANKER_REGISTRY[p_type]
    resolved_model = model_name or settings.RERANKER_MODEL

    if p_type == "bge_reranker":
        return BGERerankerProvider(
            model_name=resolved_model or "BAAI/bge-reranker-v2-m3",
            max_retries=settings.EMBEDDING_MAX_RETRIES,
        )
    elif p_type == "cohere":
        return CohereRerankerProvider(
            model_name=resolved_model or "rerank-v3.5",
            max_retries=settings.EMBEDDING_MAX_RETRIES,
        )
    elif p_type == "local":
        return LocalRerankerProvider(
            model_name=resolved_model or "local-cross-encoder-v1",
        )

    return provider_cls()
