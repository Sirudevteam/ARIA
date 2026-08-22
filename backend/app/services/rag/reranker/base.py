"""
Abstract Base Reranker Provider Interface.
Ensures zero hardcoding of cross-encoder rerankers across the ARIA application.
"""

from abc import ABC, abstractmethod
from typing import List

from app.schemas.reranker import RerankedChunk
from app.schemas.retrieval import RetrievedChunk


class BaseRerankerProvider(ABC):
    """
    Abstract interface for Cross-Encoder semantic rerankers (BGE-Reranker, Cohere, Local, etc.).
    All reranking integrations must implement this contract.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the reranker provider (e.g. 'bge_reranker', 'cohere', 'local')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Underlying cross-encoder model name (e.g. 'BAAI/bge-reranker-v2-m3', 'rerank-v3.5')."""
        pass

    @abstractmethod
    async def score_pairs(self, query: str, texts: List[str]) -> List[float]:
        """
        Compute cross-encoder relevance scores for (query, document) pairs.
        Must return normalized float scores in range [0.0, 1.0].
        """
        pass

    async def rerank(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        top_k: int = 5,
        min_threshold: float = 0.0,
    ) -> List[RerankedChunk]:
        """
        Rerank a list of candidate chunks against a query.
        Filters out irrelevant chunks below min_threshold, sorts by relevance,
        and slices to top_k.
        """
        if not chunks or not query.strip():
            return []

        texts = [c.content for c in chunks]
        scores = await self.score_pairs(query.strip(), texts)

        scored_candidates = []
        for orig_idx, (chunk, score) in enumerate(zip(chunks, scores)):
            # Discard irrelevant chunks below the minimum threshold
            if score >= min_threshold:
                scored_candidates.append((chunk, score, orig_idx + 1))

        # Sort by rerank score descending
        scored_candidates.sort(key=lambda x: x[1], reverse=True)

        # Slice to top_k
        top_candidates = scored_candidates[:top_k]

        model_id = self.get_model_identifier()
        reranked_results: List[RerankedChunk] = []

        for rerank_idx, (chunk, score, orig_rank) in enumerate(top_candidates):
            final_rank = rerank_idx + 1
            rank_delta = orig_rank - final_rank  # Positive = promoted (e.g. #4 -> #1 is +3)

            reranked_results.append(
                RerankedChunk(
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    document_title=chunk.document_title,
                    doc_type=chunk.doc_type,
                    version_number=chunk.version_number,
                    page=chunk.page,
                    section=chunk.section,
                    content=chunk.content,
                    similarity_score=chunk.similarity_score,
                    keyword_score=chunk.keyword_score,
                    combined_score=chunk.combined_score,
                    rerank_score=round(score, 4),
                    rerank_rank=final_rank,
                    original_rank=orig_rank,
                    rank_delta=rank_delta,
                    match_channel=chunk.match_channel,
                    reranker_model=model_id,
                    metadata=chunk.metadata,
                )
            )

        return reranked_results

    def get_model_identifier(self) -> str:
        """Unique model identifier signature."""
        return f"{self.provider_name}:{self.model_name}"
