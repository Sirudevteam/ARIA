"""
Local Deterministic Reranker Provider for unit tests and zero-cost offline local development.
"""

from typing import List

from app.services.rag.reranker.base import BaseRerankerProvider
from app.services.rag.reranker.providers.bge_reranker import _deterministic_cross_encoder_scoring


class LocalRerankerProvider(BaseRerankerProvider):
    """
    Fast, deterministic cross-encoder semantic interaction scorer.
    Ideal for unit tests and local development without external API calls.
    """

    def __init__(self, model_name: str = "local-cross-encoder-v1"):
        self._model_name = model_name

    @property
    def provider_name(self) -> str:
        return "local"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def score_pairs(self, query: str, texts: List[str]) -> List[float]:
        """Compute cross-encoder relevance scores."""
        return [_deterministic_cross_encoder_scoring(query, t) for t in texts]
