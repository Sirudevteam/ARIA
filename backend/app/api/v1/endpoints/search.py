"""
Search & Hybrid Retrieval API Endpoints for ARIA.
Provides enterprise semantic vector + keyword + RRF retrieval with pre-retrieval authorization
and 2-stage Cross-Encoder semantic reranking.
"""

from typing import Optional, Tuple
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    DBSession,
    get_current_user,
    get_project_and_membership,
)
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.retrieval import (
    RetrievalFilters,
    RetrievalRequest,
    RetrievalResponse,
)
from app.services.rag.reranker.service import reranker_service
from app.services.rag.retrieval import hybrid_retrieval_engine

router = APIRouter(prefix="/search", tags=["Hybrid Retrieval & Search"])


@router.post(
    "/retrieve",
    response_model=RetrievalResponse,
    summary="Execute 2-stage hybrid retrieval & reranking",
    description="Performs pre-filtered hybrid retrieval (pgvector dense + BM25 keyword + RRF fusion) and cross-encoder semantic reranking across accessible projects.",
)
async def hybrid_retrieve(
    body: RetrievalRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> RetrievalResponse:
    """Execute 2-stage hybrid retrieval & reranking across user's accessible scope."""
    # 1. Resolve user authorization context
    user_context = await hybrid_retrieval_engine.resolve_user_context(db=db, user=current_user)

    # 2. Build filters
    filters = RetrievalFilters(
        project_ids=[body.project_id] if body.project_id else None,
        department_ids=[body.department_id] if body.department_id else None,
        current_version_only=body.current_version_only,
        min_similarity_threshold=body.min_threshold,
    )

    # 3. Execute 2-stage hybrid retrieval + reranking
    results = await hybrid_retrieval_engine.retrieve_and_rerank(
        db=db,
        query=body.query,
        user_context=user_context,
        filters=filters,
        candidate_k=body.candidate_k,
        final_top_k=body.top_k,
        alpha=body.alpha,
        fusion_mode=body.fusion_mode,
        min_relevance_threshold=body.min_relevance_threshold,
        enable_rerank=body.enable_rerank,
    )

    reranker_model = (
        reranker_service.provider.get_model_identifier()
        if body.enable_rerank
        else None
    )

    return RetrievalResponse(
        query=body.query,
        total_results=len(results),
        top_k=body.top_k,
        alpha=body.alpha,
        fusion_mode=body.fusion_mode,
        reranker_enabled=body.enable_rerank,
        reranker_model=reranker_model,
        results=results,
    )


@router.post(
    "/projects/{project_id}/retrieve",
    response_model=RetrievalResponse,
    summary="Execute project-scoped 2-stage hybrid retrieval",
    description="Performs 2-stage hybrid retrieval and semantic reranking strictly scoped to a specific project.",
)
async def project_hybrid_retrieve(
    project_id: uuid.UUID,
    body: RetrievalRequest,
    context: Tuple[Project, Optional[ProjectMember]] = Depends(get_project_and_membership),
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> RetrievalResponse:
    """Execute 2-stage hybrid retrieval & reranking scoped to an authenticated project."""
    project, _ = context
    user_context = await hybrid_retrieval_engine.resolve_user_context(db=db, user=current_user)

    filters = RetrievalFilters(
        project_ids=[project.id],
        department_ids=[body.department_id] if body.department_id else None,
        current_version_only=body.current_version_only,
        min_similarity_threshold=body.min_threshold,
    )

    results = await hybrid_retrieval_engine.retrieve_and_rerank(
        db=db,
        query=body.query,
        user_context=user_context,
        filters=filters,
        candidate_k=body.candidate_k,
        final_top_k=body.top_k,
        alpha=body.alpha,
        fusion_mode=body.fusion_mode,
        min_relevance_threshold=body.min_relevance_threshold,
        enable_rerank=body.enable_rerank,
    )

    reranker_model = (
        reranker_service.provider.get_model_identifier()
        if body.enable_rerank
        else None
    )

    return RetrievalResponse(
        query=body.query,
        total_results=len(results),
        top_k=body.top_k,
        alpha=body.alpha,
        fusion_mode=body.fusion_mode,
        reranker_enabled=body.enable_rerank,
        reranker_model=reranker_model,
        results=results,
    )
