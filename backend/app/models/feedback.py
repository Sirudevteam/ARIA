"""
Feedback and AuditLog models.
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.conversation import Message
    from app.models.organization import Organization
    from app.models.user import User


class FeedbackRating(str, enum.Enum):
    thumbs_up = "thumbs_up"
    thumbs_down = "thumbs_down"


class AuditAction(str, enum.Enum):
    create = "create"
    read = "read"
    update = "update"
    delete = "delete"
    login = "login"
    logout = "logout"
    upload = "upload"
    download = "download"
    invite = "invite"
    revoke = "revoke"
    export = "export"


class Feedback(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "feedback"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[FeedbackRating] = mapped_column(
        Enum(FeedbackRating, name="feedback_rating"), nullable=False
    )
    comment: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    message: Mapped["Message"] = relationship(back_populates="feedback")
    user: Mapped["User"] = relationship(back_populates="feedback")

    def __repr__(self) -> str:
        return f"<Feedback {self.rating} on msg {self.message_id}>"


class AuditLog(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "audit_logs"

    # Append-only — immutable audit events
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[AuditAction] = mapped_column(
        Enum(AuditAction, name="audit_action"), nullable=False
    )
    resource: Mapped[str] = mapped_column(String, nullable=False)
    resource_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    ip_address: Mapped[str] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str] = mapped_column(Text, nullable=True)
    old_value: Mapped[dict] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict] = mapped_column(JSONB, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship()
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} on {self.resource}>"
