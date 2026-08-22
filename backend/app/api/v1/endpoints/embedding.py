"""
Embedding API Endpoints.
Provides provider introspection, chunk embedding triggers, re-embedding, and query vector generation.
"""

from typing import Any, Dict, List, Optional, Tuple
import uuid

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession, get_current_user, get_document_with_access
from app.models.document import Document
from app.models.project import Project
from app.models.user import User
from app.services.embedding.service import embedding_service

router = APIRouter(prefix="/embedding", tags=["Embedding Service"])


class EmbeddingInfoResponse(BaseModel):
    provider: str
    model_name: str
    dimensions: int
    model_identifier: str
    batch_size: int
    max_retries: int


class QueryEmbeddingRequest(BaseModel):
    query: str


class QueryEmbeddingResponse(BaseModel):
    query: str
    dimensions: int
    model_identifier: str
    embedding: List[float]


@router.get(
    "/info",
    response_model=EmbeddingInfoResponse,
    summary="Get active embedding provider info",
    description="Returns metadata about the active embedding provider, model name, and vector dimensions.",
)
async def get_embedding_info() -> EmbeddingInfoResponse:
    """Introspect the active embedding provider."""
    provider = embedding_service.provider
    from app.core.config import get_settings
    st = get_settings()

    return EmbeddingInfoResponse(
        provider=provider.provider_name,
        model_name=provider.model_name,
        dimensions=provider.dimensions,
        model_identifier=provider.get_model_identifier(),
        batch_size=st.EMBEDDING_BATCH_SIZE,
        max_retries=st.EMBEDDING_MAX_RETRIES,
    )


@router.post(
    "/query",
    response_model=QueryEmbeddingResponse,
    summary="Generate embedding vector for a query",
    description="Embeds a search query string into a unit-normalized dense vector.",
)
async def embed_search_query(
    body: QueryEmbeddingRequest,
    current_user: User = Depends(get_current_user),
) -> QueryEmbeddingResponse:
    """Generate vector for a search query string."""
    vector = await embedding_service.embed_query(body.query)
    provider = embedding_service.provider
    return QueryEmbeddingResponse(
        query=body.query,
        dimensions=len(vector),
        model_identifier=provider.get_model_identifier(),
        embedding=vector,
    )


@router.post(
    "/documents/{document_id}/reembed",
    summary="Re-embed document chunks",
    description="Re-calculates embeddings for all chunks of a document (e.g. after model upgrade or force re-index).",
)
async def reembed_document_chunks(
    document_id: uuid.UUID,
    force: bool = Query(True, description="Force re-embedding even if content hash matches"),
    context: Tuple[Document, Project] = Depends(get_document_with_access),
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> Dict[str, Any]:
    """Force re-embedding of document chunks."""
    doc, _ = context
    result = await embedding_service.reembed_document(db=db, document_id=doc.id, force=force)
    return {
        "success": True,
        "document_id": str(doc.id),
        "document_title": doc.title,
        **result,
    }
