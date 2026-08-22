"""
Domain Reranker Service for ARIA.
Executes Cross-Encoder reranking on candidate chunks, filters out irrelevant chunks
below the relevance threshold, and sorts top-K precision context.
"""

from typing import List, Optional

from app.core.config import get_settings
from app.schemas.reranker import RerankedChunk
from app.schemas.retrieval import RetrievedChunk
from app.services.rag.reranker.base import BaseRerankerProvider
from app.services.rag.reranker.factory import get_reranker_provider

settings = get_settings()


class RerankerService:
    """
    High-level Semantic Reranking Service.
    Guarantees that irrelevant chunks are discarded before reaching LLM generation.
    """

    def __init__(self, provider: Optional[BaseRerankerProvider] = None):
        self._provider = provider or get_reranker_provider()

    @property
    def provider(self) -> BaseRerankerProvider:
        return self._provider

    def set_provider(self, provider: BaseRerankerProvider) -> None:
        """Allow runtime swapping of the active reranker provider."""
        self._provider = provider

    async def rerank_candidates(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        top_k: Optional[int] = None,
        min_threshold: Optional[float] = None,
    ) -> List[RerankedChunk]:
        """
        Reranks a list of candidate retrieved chunks (e.g. 20 chunks from hybrid retrieval)
        and returns the top-K highest precision chunks meeting min_threshold.
        """
        effective_top_k = top_k if top_k is not None else settings.RETRIEVAL_FINAL_TOP_K
        effective_threshold = (
            min_threshold if min_threshold is not None else settings.RERANKER_MIN_THRESHOLD
        )

        return await self._provider.rerank(
            query=query,
            chunks=chunks,
            top_k=effective_top_k,
            min_threshold=effective_threshold,
        )


# Singleton domain reranker instance
reranker_service = RerankerService()
