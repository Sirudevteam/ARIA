"""
Team and TeamMember models.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.organization import Organization
    from app.models.role import Role
    from app.models.user import User


class Team(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "teams"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="teams")
    department: Mapped["Department"] = relationship(back_populates="teams")

    def __repr__(self) -> str:
        return f"<Team {self.name}>"
