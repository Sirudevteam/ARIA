"""
Conversation, Message, and MessageSource models.
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.document import Document, DocumentChunk
    from app.models.feedback import Feedback
    from app.models.project import Project
    from app.models.user import User


class ConversationStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class MessageRole(str, enum.Enum):
    system = "system"
    user = "user"
    assistant = "assistant"


class Conversation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "conversations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus, name="conversation_status"),
        default=ConversationStatus.active,
        nullable=False,
    )
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="conversations")
    project: Mapped["Project"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )

    def __repr__(self) -> str:
        return f"<Conversation {self.id} ({self.status})>"


class Message(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=True)
    model_used: Mapped[str] = mapped_column(String, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    finish_reason: Mapped[str] = mapped_column(String, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    sources: Mapped[list["MessageSource"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )
    feedback: Mapped[list["Feedback"]] = relationship(back_populates="message")

    def __repr__(self) -> str:
        return f"<Message {self.role} in conv {self.conversation_id}>"


class MessageSource(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "message_sources"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    relevance: Mapped[float] = mapped_column(Float, nullable=True)
    excerpt: Mapped[str] = mapped_column(Text, nullable=True)
    page_number: Mapped[int] = mapped_column(Integer, nullable=True)

    # Relationships
    message: Mapped["Message"] = relationship(back_populates="sources")
    chunk: Mapped["DocumentChunk"] = relationship(back_populates="sources")
    document: Mapped["Document"] = relationship()
