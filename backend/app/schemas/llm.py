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
    user_name: Optional[str] = Field(None, description="Optional display name of the user asking the question")
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
    usage: Optional[TokenUsage] = None
    latency_ms: float = 0.0


class ChatFeedbackRequest(BaseModel):
    """Payload for submitting employee thumbs up / down feedback."""

    query: str = Field(..., description="The user query that generated the response")
    response_content: Optional[str] = Field(None, description="The AI response text")
    rating: Literal["like", "dislike"] = Field(..., description="Employee rating: like or dislike")
    reason: Optional[str] = Field(None, description="Categorized reason for negative feedback")
    comment: Optional[str] = Field(None, description="Optional employee detail explanation")
    project_id: Optional[uuid.UUID] = None


class ChatFeedbackResponse(BaseModel):
    """Response confirming recorded feedback."""

    id: uuid.UUID
    status: str = "RECORDED"
    message: str = "Feedback successfully logged. If negative, flagged for Admin SOP review."


class KnowledgeGapResolutionRequest(BaseModel):
    """Payload for admin resolving an identified knowledge gap by adding/updating SOP content."""

    unanswered_id: Optional[uuid.UUID] = None
    query: str = Field(..., description="The query that lacked documentation")
    document_title: str = Field(..., description="Target document title (e.g. 'Urban LiDAR 3D Annotation SOP')")
    section_name: str = Field(..., description="Section heading (e.g. 'Emergency Vehicle Bounding Box')")
    page_number: Optional[int] = 1
    new_guideline_content: str = Field(..., min_length=10, description="The verified SOP text to index")
    project_id: Optional[uuid.UUID] = None


class KnowledgeGapResolutionResponse(BaseModel):
    """Confirmation of newly indexed SOP chunk and resolution status."""

    status: str = "RESOLVED"
    document_title: str
    section_name: str
    chunk_id: str
    vector_dimension: int = 1024
    embedding_model: str = "BAAI/bge-m3"
    message: str = "Knowledge gap resolved. New SOP chunk embedded and indexed in pgvector."

