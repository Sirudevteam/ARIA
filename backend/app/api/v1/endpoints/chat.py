"""
Chat & LLM Streaming Endpoints for ARIA.
Provides enterprise grounded RAG conversational question answering with
Server-Sent Events (SSE) streaming and DeepSeek-V3 / DeepSeek-R1 inference.
"""

from typing import Optional
import uuid

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession, get_current_user
from app.models.user import User
from app.schemas.llm import RAGChatRequest, RAGChatResponse
from app.schemas.retrieval import RetrievalFilters
from app.services.rag.generator import rag_generator_service
from app.services.rag.retrieval import hybrid_retrieval_engine

router = APIRouter(prefix="/chat", tags=["RAG Chat & LLM Generation"])


@router.post(
    "/completions",
    response_model=RAGChatResponse,
    summary="Execute grounded RAG chat completion",
    description="Performs 2-stage retrieval, reranking, citation assembly, and DeepSeek LLM generation (non-streaming).",
)
async def chat_completions(
    body: RAGChatRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> RAGChatResponse:
    """Non-streaming RAG chat response with verified citations."""
    user_context = await hybrid_retrieval_engine.resolve_user_context(db=db, user=current_user)

    filters = RetrievalFilters(
        project_ids=[body.project_id] if body.project_id else None,
        current_version_only=True,
    )

    return await rag_generator_service.generate_rag_response(
        db=db,
        query=body.query,
        user_context=user_context,
        filters=filters,
        conversation_history=body.conversation_history,
        candidate_k=body.candidate_k,
        top_k=body.top_k,
        min_relevance_threshold=body.min_relevance_threshold,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
    )


@router.post(
    "/stream",
    summary="Execute real-time streaming RAG chat (Server-Sent Events SSE)",
    description="Streams verified citations first, then real-time text/reasoning tokens via text/event-stream.",
)
async def chat_stream(
    body: RAGChatRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> StreamingResponse:
    """Real-time SSE streaming RAG chat endpoint."""
    user_context = await hybrid_retrieval_engine.resolve_user_context(db=db, user=current_user)

    filters = RetrievalFilters(
        project_ids=[body.project_id] if body.project_id else None,
        current_version_only=True,
    )

    stream_generator = rag_generator_service.generate_rag_stream(
        db=db,
        query=body.query,
        user_context=user_context,
        filters=filters,
        conversation_history=body.conversation_history,
        candidate_k=body.candidate_k,
        top_k=body.top_k,
        min_relevance_threshold=body.min_relevance_threshold,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
    )

    return StreamingResponse(
        stream_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
