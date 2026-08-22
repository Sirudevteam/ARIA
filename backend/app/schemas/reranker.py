"""
Data models and schemas for Semantic Reranker layer.
"""

from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.retrieval import RetrievedChunk


class RerankedChunk(BaseModel):
    """
    Precision-ranked context chunk produced by the cross-encoder reranker layer.
    """

    model_config = ConfigDict(from_attributes=True)

    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    doc_type: str
    version_number: int = 1
    page: Optional[int] = None
    section: Optional[str] = None
    content: str
    similarity_score: Optional[float] = None
    keyword_score: Optional[float] = None
    combined_score: float
    rerank_score: float = Field(..., description="Cross-encoder semantic relevance score [0, 1]")
    rerank_rank: int = Field(..., description="Final 1-indexed rank after reranking")
    original_rank: int = Field(..., description="1-indexed candidate rank before reranking")
    rank_delta: int = Field(0, description="Rank movement: (original_rank - rerank_rank). Positive = promoted")
    match_channel: str = "hybrid"
    reranker_model: str = "bge-reranker-v2-m3"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RerankRequest(BaseModel):
    """Payload for standalone reranking service endpoint."""

    query: str
    candidate_chunks: List[RetrievedChunk]
    top_k: int = Field(5, ge=1, le=50)
    min_threshold: float = Field(0.25, ge=0.0, le=1.0)


class RerankResponse(BaseModel):
    """Response from reranker layer containing top-N high-precision chunks."""

    query: str
    initial_candidate_count: int
    final_top_k: int
    reranker_model: str
    min_threshold: float
    results: List[RerankedChunk]
