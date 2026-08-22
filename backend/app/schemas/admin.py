"""
Data models and schemas for Enterprise Admin Dashboard analytics and telemetry.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, Field


class AdminOverviewKPIs(BaseModel):
    """Core 6 KPI metrics displayed on top of the Admin Dashboard."""

    total_documents: int = Field(248, description="Total active documents across projects")
    total_users: int = Field(64, description="Total active users across 7 role tiers")
    total_projects: int = Field(8, description="Total active autonomous perception projects")
    total_questions: int = Field(4821, description="Total answered RAG questions")
    total_feedback: int = Field(3912, description="Total user feedback ratings recorded")
    total_failed_queries: int = Field(87, description="Total unanswered or low-confidence queries")
    positive_feedback_rate: float = Field(0.942, description="Positive satisfaction rate (94.2%)")
    avg_latency_ms: float = Field(320.5, description="Average end-to-end RAG response latency")


class QueryVolumeStat(BaseModel):
    """Daily query volume time series data."""

    date: str
    total_queries: int
    successful_queries: int
    failed_queries: int


class UnansweredQueryItem(BaseModel):
    """Low-confidence or failed query requiring SOP / guideline addition."""

    id: uuid.UUID
    query: str
    project_id: Optional[uuid.UUID] = None
    project_name: str = "General"
    timestamp: str
    confidence_score: float
    user_email: str
    status: str = "pending"  # "pending", "added_to_sop", "dismissed"


class AIUsageStats(BaseModel):
    """DeepSeek token consumption and cost telemetry."""

    total_prompt_tokens: int = Field(18420500, description="Total input prompt tokens")
    total_completion_tokens: int = Field(6210400, description="Total output completion tokens")
    total_tokens: int = Field(24630900, description="Total tokens processed")
    estimated_cost_usd: float = Field(12.45, description="Estimated total API cost in USD")
    active_model: str = "deepseek-chat"
    active_embedding_model: str = "BAAI/bge-m3"
    active_reranker_model: str = "BAAI/bge-reranker-v2-m3"


class FeedbackAnalytics(BaseModel):
    """Quality assurance feedback rating breakdown."""

    total_feedback: int = 3912
    positive_count: int = 3685
    negative_count: int = 227
    satisfaction_rate: float = 94.2
    top_negative_reasons: List[Dict[str, Any]] = Field(default_factory=list)


class AuditLogEntry(BaseModel):
    """Zero-trust security audit event."""

    id: uuid.UUID
    timestamp: str
    actor_email: str
    actor_role: str
    action: str
    resource_type: str
    resource_name: str
    ip_address: str
    status: str = "SUCCESS"
