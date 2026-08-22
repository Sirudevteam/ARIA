"""
Data models and schemas for Hybrid Retrieval Engine.
"""

from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.document import DocStatus, DocType


class UserContext(BaseModel):
    """Authenticated user context for pre-retrieval authorization filtering."""

    user_id: uuid.UUID
    organization_id: uuid.UUID
    role_name: str
    accessible_project_ids: List[uuid.UUID] = Field(default_factory=list)


class RetrievalFilters(BaseModel):
    """Multi-criteria filtering applied BEFORE candidate retrieval."""

    project_ids: Optional[List[uuid.UUID]] = None
    department_ids: Optional[List[uuid.UUID]] = None
    doc_types: Optional[List[str]] = None
    doc_statuses: List[str] = Field(default=["READY"])
    current_version_only: bool = True
    confidentiality: Optional[List[str]] = None
    min_similarity_threshold: float = 0.0


class RetrievedChunk(BaseModel):
    """Unified hybrid retrieval output item."""

    model_config = ConfigDict(from_attributes=True)

    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    doc_type: str
    version_number: int = 1
    page: Optional[int] = None
    section: Optional[str] = None
    content: str
    similarity_score: Optional[float] = None  # Normalized Dense Score [0, 1]
    keyword_score: Optional[float] = None     # Normalized Sparse Score [0, 1]
    combined_score: float                     # Fused Hybrid Score [0, 1]
    dense_rank: Optional[int] = None
    keyword_rank: Optional[int] = None
    match_channel: str = "hybrid"            # "both", "vector_only", "keyword_only"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RetrievalRequest(BaseModel):
    """API payload for 2-stage hybrid retrieval and semantic reranking."""

    query: str = Field(..., min_length=1, description="Search query string")
    project_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    candidate_k: int = Field(20, ge=1, le=100, description="Stage 1: Candidates to retrieve before reranking")
    top_k: int = Field(5, ge=1, le=50, description="Stage 2: Final precision chunks to return")
    alpha: float = Field(0.5, ge=0.0, le=1.0, description="Weight for Dense Vector (1.0 = vector only, 0.0 = keyword only)")
    fusion_mode: str = Field("rrf", description="Fusion algorithm: 'rrf' (Reciprocal Rank Fusion) or 'weighted'")
    current_version_only: bool = True
    min_threshold: float = 0.0
    enable_rerank: bool = Field(True, description="Whether to execute cross-encoder semantic reranking")
    min_relevance_threshold: float = Field(0.25, ge=0.0, le=1.0, description="Filter out chunks below this relevance score")


class RetrievalResponse(BaseModel):
    """API response containing precision-ranked context chunks."""

    query: str
    total_results: int
    top_k: int
    alpha: float
    fusion_mode: str
    reranker_enabled: bool = True
    reranker_model: Optional[str] = None
    results: List[Any]
