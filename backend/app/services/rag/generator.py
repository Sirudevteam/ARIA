"""
RAG Generation Orchestrator Service.
Connects 2-Stage Retrieval & Reranker with LLM Provider Abstraction (DeepSeek)
for grounded non-streaming and Server-Sent Events (SSE) streaming chat.
"""

import json
from typing import AsyncGenerator, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.llm import ChatMessage, LLMResponse, RAGChatResponse
from app.schemas.reranker import RerankedChunk
from app.schemas.retrieval import RetrievalFilters, UserContext
from app.services.llm.base import BaseLLMProvider
from app.services.llm.factory import get_llm_provider
from app.services.rag.prompt_composer import prompt_composer
from app.services.rag.retrieval import hybrid_retrieval_engine


class RAGGeneratorService:
    """
    Decoupled RAG Generation Service coordinating Retrieval, Reranking, Prompt Composition,
    and LLM inference.
    """

    def __init__(self, llm_provider: Optional[BaseLLMProvider] = None):
        self._llm_provider = llm_provider or get_llm_provider()

    @property
    def llm_provider(self) -> BaseLLMProvider:
        return self._llm_provider

    def set_llm_provider(self, provider: BaseLLMProvider) -> None:
        """Allow runtime swapping of the underlying LLM provider."""
        self._llm_provider = provider

    async def generate_rag_response(
        self,
        db: AsyncSession,
        query: str,
        user_context: UserContext,
        filters: Optional[RetrievalFilters] = None,
        conversation_history: Optional[List[ChatMessage]] = None,
        candidate_k: int = 20,
        top_k: int = 5,
        min_relevance_threshold: float = 0.25,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> RAGChatResponse:
        """
        Execute full RAG generation (non-streaming):
        Retrieval -> Rerank -> Prompt Assembly -> LLM Completion.
        """
        # 1. 2-Stage Hybrid Retrieval & Cross-Encoder Reranking
        citations = await hybrid_retrieval_engine.retrieve_and_rerank(
            db=db,
            query=query,
            user_context=user_context,
            filters=filters,
            candidate_k=candidate_k,
            final_top_k=top_k,
            min_relevance_threshold=min_relevance_threshold,
            enable_rerank=True,
        )

        # 2. Compose grounded prompt messages
        messages = prompt_composer.compose_messages(
            query=query,
            citations=citations,
            conversation_history=conversation_history,
        )

        # 3. Call LLM Provider
        response = await self._llm_provider.generate(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return RAGChatResponse(
            query=query,
            answer=response.content,
            reasoning_content=response.reasoning_content,
            citations=citations,
            model=response.model,
            usage=response.usage,
            latency_ms=response.latency_ms,
        )

    async def generate_rag_stream(
        self,
        db: AsyncSession,
        query: str,
        user_context: UserContext,
        filters: Optional[RetrievalFilters] = None,
        conversation_history: Optional[List[ChatMessage]] = None,
        candidate_k: int = 20,
        top_k: int = 5,
        min_relevance_threshold: float = 0.25,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Execute full RAG generation with Server-Sent Events (SSE) streaming.
        Emits citations first, then real-time text/reasoning tokens, and finally token usage.
        """
        # 1. Retrieve and rerank precision citations
        citations = await hybrid_retrieval_engine.retrieve_and_rerank(
            db=db,
            query=query,
            user_context=user_context,
            filters=filters,
            candidate_k=candidate_k,
            final_top_k=top_k,
            min_relevance_threshold=min_relevance_threshold,
            enable_rerank=True,
        )

        # 2. Emit citations metadata chunk via SSE
        citations_payload = {
            "type": "citations",
            "count": len(citations),
            "citations": [c.model_dump(mode="json") for c in citations],
        }
        yield f"data: {json.dumps(citations_payload)}\n\n"

        # 3. Compose grounded prompt messages
        messages = prompt_composer.compose_messages(
            query=query,
            citations=citations,
            conversation_history=conversation_history,
        )

        # 4. Stream LLM tokens
        async for chunk in self._llm_provider.generate_stream(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            if chunk.done:
                done_payload = {
                    "type": "done",
                    "usage": chunk.usage.model_dump() if chunk.usage else None,
                    "finish_reason": chunk.finish_reason or "stop",
                }
                yield f"data: {json.dumps(done_payload)}\n\n"
            else:
                token_payload = {
                    "type": "delta",
                    "delta": chunk.delta,
                    "reasoning_delta": chunk.reasoning_delta,
                }
                yield f"data: {json.dumps(token_payload)}\n\n"


rag_generator_service = RAGGeneratorService()
