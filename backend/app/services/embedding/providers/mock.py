"""
Deterministic Mock Embedding Provider for fast unit tests and zero-cost local development.
"""

from typing import List

from app.services.embedding.base import BaseEmbeddingProvider
from app.services.embedding.providers.bge_m3 import _deterministic_dense_projection


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Mock Embedding Provider that produces deterministic unit-normalized vectors.
    Useful for unit testing without network overhead or API credentials.
    """

    def __init__(
        self,
        model_name: str = "mock-embedding-v1",
        dimensions: int = 1024,
    ):
        self._model_name = model_name
        self._dimensions = dimensions

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimensions(self) -> int:
        return self._dimensions

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate deterministic unit-normalized vectors for test chunks."""
        return [_deterministic_dense_projection(t, self._dimensions) for t in texts]

    async def embed_query(self, query: str) -> List[float]:
        """Generate deterministic unit-normalized vector for test query."""
        return _deterministic_dense_projection(query, self._dimensions)
