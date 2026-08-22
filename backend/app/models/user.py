"""
User model.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.feedback import Feedback
    from app.models.organization import Organization
    from app.models.role import Role


class UserStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    inactive = "inactive"
    suspended = "suspended"


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    avatar_url: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"), default=UserStatus.pending, nullable=False
    )
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    @property
    def last_seen_at(self) -> Optional[datetime]:
        return self.last_login_at

    @last_seen_at.setter
    def last_seen_at(self, value: Optional[datetime]) -> None:
        self.last_login_at = value

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="users")
    role: Mapped["Role"] = relationship()
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user")
    feedback: Mapped[list["Feedback"]] = relationship(back_populates="user")

    def __repr__(self) -> str:
        return f"<User {self.email}>"
