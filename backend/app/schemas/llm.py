"""
Data models and schemas for LLM Provider abstraction, DeepSeek integration,
and RAG generation streaming.
"""

from typing import Any, Dict, List, Literal, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.reranker import RerankedChunk


class ChatMessage(BaseModel):
    """Unified chat message representation."""

    role: Literal["system", "user", "assistant"] = Field(..., description="Message author role")
    content: str = Field(..., description="Message text content")
    name: Optional[str] = None


class TokenUsage(BaseModel):
    """Detailed token consumption and cache hit metrics."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    prompt_cache_hit_tokens: Optional[int] = None
    prompt_cache_miss_tokens: Optional[int] = None


class LLMResponse(BaseModel):
    """Non-streaming structured LLM generation response."""

    content: str = Field(..., description="Generated text output")
    reasoning_content: Optional[str] = Field(None, description="DeepSeek-R1 reasoning / thinking trace")
    model: str
    usage: TokenUsage
    latency_ms: float
    finish_reason: str = "stop"


class LLMStreamChunk(BaseModel):
    """Streaming chunk emitted via Server-Sent Events (SSE)."""

    delta: str = ""
    reasoning_delta: Optional[str] = None
    done: bool = False
    usage: Optional[TokenUsage] = None
    finish_reason: Optional[str] = None


class RAGChatRequest(BaseModel):
    """API payload for grounded RAG conversational question answering."""

    query: str = Field(..., min_length=1, description="User's natural language question")
    project_id: Optional[uuid.UUID] = Field(None, description="Optional scoped project filter")
    conversation_history: List[ChatMessage] = Field(default_factory=list, description="Prior conversational context")
    stream: bool = Field(True, description="Whether to stream response via Server-Sent Events (SSE)")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1, le=8192)
    candidate_k: int = Field(20, ge=1, le=100)
    top_k: int = Field(5, ge=1, le=20)
    min_relevance_threshold: float = Field(0.25, ge=0.0, le=1.0)


class RAGChatResponse(BaseModel):
    """Non-streaming response from grounded RAG generation pipeline."""

    query: str
    answer: str
    reasoning_content: Optional[str] = None
    citations: List[RerankedChunk]
    model: str
    usage: TokenUsage
    latency_ms: float
