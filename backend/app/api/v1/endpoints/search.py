"""
Search & Hybrid Retrieval API Endpoints for ARIA.
Provides enterprise semantic vector + keyword + RRF retrieval with pre-retrieval authorization.
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
from app.services.rag.retrieval import hybrid_retrieval_engine

router = APIRouter(prefix="/search", tags=["Hybrid Retrieval & Search"])


@router.post(
    "/retrieve",
    response_model=RetrievalResponse,
    summary="Execute hybrid document retrieval",
    description="Performs pre-filtered hybrid retrieval (pgvector dense + BM25 keyword + RRF fusion) across accessible projects.",
)
async def hybrid_retrieve(
    body: RetrievalRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> RetrievalResponse:
    """Execute multi-criteria hybrid retrieval across user's accessible scope."""
    # 1. Resolve user authorization context
    user_context = await hybrid_retrieval_engine.resolve_user_context(db=db, user=current_user)

    # 2. Build filters
    filters = RetrievalFilters(
        project_ids=[body.project_id] if body.project_id else None,
        department_ids=[body.department_id] if body.department_id else None,
        current_version_only=body.current_version_only,
        min_similarity_threshold=body.min_threshold,
    )

    # 3. Execute hybrid retrieval
    results = await hybrid_retrieval_engine.retrieve(
        db=db,
        query=body.query,
        user_context=user_context,
        filters=filters,
        top_k=body.top_k,
        alpha=body.alpha,
        fusion_mode=body.fusion_mode,
    )

    return RetrievalResponse(
        query=body.query,
        total_results=len(results),
        top_k=body.top_k,
        alpha=body.alpha,
        fusion_mode=body.fusion_mode,
        results=results,
    )


@router.post(
    "/projects/{project_id}/retrieve",
    response_model=RetrievalResponse,
    summary="Execute project-scoped hybrid retrieval",
    description="Performs hybrid retrieval strictly scoped to a specific project.",
)
async def project_hybrid_retrieve(
    project_id: uuid.UUID,
    body: RetrievalRequest,
    context: Tuple[Project, Optional[ProjectMember]] = Depends(get_project_and_membership),
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> RetrievalResponse:
    """Execute hybrid retrieval scoped to an authenticated project."""
    project, _ = context
    user_context = await hybrid_retrieval_engine.resolve_user_context(db=db, user=current_user)

    filters = RetrievalFilters(
        project_ids=[project.id],
        department_ids=[body.department_id] if body.department_id else None,
        current_version_only=body.current_version_only,
        min_similarity_threshold=body.min_threshold,
    )

    results = await hybrid_retrieval_engine.retrieve(
        db=db,
        query=body.query,
        user_context=user_context,
        filters=filters,
        top_k=body.top_k,
        alpha=body.alpha,
        fusion_mode=body.fusion_mode,
    )

    return RetrievalResponse(
        query=body.query,
        total_results=len(results),
        top_k=body.top_k,
        alpha=body.alpha,
        fusion_mode=body.fusion_mode,
        results=results,
    )
