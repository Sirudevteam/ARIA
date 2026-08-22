"""
Department model.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.team import Team


class Department(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "departments"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="departments")
    teams: Mapped[list["Team"]] = relationship(back_populates="department")

    def __repr__(self) -> str:
        return f"<Department {self.name}>"
