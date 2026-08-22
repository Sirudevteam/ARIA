"""
Cohere Reranker Provider (rerank-v3.5 / rerank-english-v3.0).
"""

from typing import List, Optional
import httpx

from app.core.config import get_settings
from app.services.embedding.retry import with_retry
from app.services.rag.reranker.base import BaseRerankerProvider
from app.services.rag.reranker.providers.bge_reranker import _deterministic_cross_encoder_scoring

settings = get_settings()


class CohereRerankerProvider(BaseRerankerProvider):
    """
    Cohere Reranker Provider using Cohere V2 Rerank API.
    """

    def __init__(
        self,
        model_name: str = "rerank-v3.5",
        api_key: Optional[str] = None,
        max_retries: int = 3,
    ):
        self._model_name = model_name
        self._api_key = api_key or settings.COHERE_API_KEY
        self._max_retries = max_retries
        self._endpoint = "https://api.cohere.com/v2/rerank"

    @property
    def provider_name(self) -> str:
        return "cohere"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def _call_cohere_api(self, query: str, texts: List[str]) -> List[float]:
        """Call Cohere /v2/rerank endpoint."""
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model_name,
            "query": query,
            "documents": texts,
            "top_n": len(texts),
            "return_documents": False,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self._endpoint, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

            # Map relevance scores back to original indices
            scores = [0.0] * len(texts)
            for item in data.get("results", []):
                idx = item["index"]
                score = item["relevance_score"]
                scores[idx] = round(float(score), 4)

            return scores

    async def score_pairs(self, query: str, texts: List[str]) -> List[float]:
        """Score (query, text) pairs using Cohere or fallback."""
        if not texts:
            return []

        if self._api_key:
            try:
                return await with_retry(
                    self._call_cohere_api,
                    query,
                    texts,
                    max_retries=self._max_retries,
                    retryable_exceptions=(httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException),
                )
            except Exception:
                pass

        # Offline / local fallback
        return [_deterministic_cross_encoder_scoring(query, t) for t in texts]
