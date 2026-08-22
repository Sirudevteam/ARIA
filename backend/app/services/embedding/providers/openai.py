"""
OpenAI Embedding Provider (text-embedding-3-small / text-embedding-3-large / ada-002).
"""

import math
from typing import List, Optional
import httpx

from app.core.config import get_settings
from app.services.embedding.base import BaseEmbeddingProvider
from app.services.embedding.providers.bge_m3 import _deterministic_dense_projection, _normalize_vector
from app.services.embedding.retry import with_retry

settings = get_settings()


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """
    OpenAI Embedding Provider using official text-embedding-3-small or text-embedding-3-large.
    Outputs 1536-dimensional (or 3072-dimensional) unit vectors.
    """

    def __init__(
        self,
        model_name: str = "text-embedding-3-small",
        dimensions: int = 1536,
        api_key: Optional[str] = None,
        max_retries: int = 3,
    ):
        self._model_name = model_name
        self._dimensions = dimensions
        self._api_key = api_key or settings.OPENAI_API_KEY
        self._max_retries = max_retries

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimensions(self) -> int:
        return self._dimensions

    async def _call_openai_api(self, texts: List[str]) -> List[List[float]]:
        """Call OpenAI Embeddings API via httpx."""
        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model_name,
            "input": texts,
            "dimensions": self._dimensions,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            # Extract embedding vectors sorted by index
            data_items = sorted(data["data"], key=lambda x: x["index"])
            return [_normalize_vector(item["embedding"]) for item in data_items]

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a batch of texts using OpenAI API.
        Falls back to deterministic local projection if API key is not configured.
        """
        if not texts:
            return []

        if self._api_key:
            try:
                return await with_retry(
                    self._call_openai_api,
                    texts,
                    max_retries=self._max_retries,
                    retryable_exceptions=(httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException),
                )
            except Exception:
                # Fallback to local dense projection if OpenAI is unavailable
                pass

        # Offline / test fallback
        return [_deterministic_dense_projection(t, self._dimensions) for t in texts]

    async def embed_query(self, query: str) -> List[float]:
        """Embed a single query string using OpenAI."""
        results = await self.embed_texts([query])
        return results[0] if results else [0.0] * self._dimensions
