"""
Role model.
"""

import enum
import uuid

from sqlalchemy import Boolean, Enum, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, UUIDMixin


class RoleScope(str, enum.Enum):
    system = "system"
    organization = "organization"
    project = "project"


class Role(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String, nullable=False)
    scope: Mapped[RoleScope] = mapped_column(
        Enum(RoleScope, name="role_scope"), default=RoleScope.organization, nullable=False
    )
    permissions: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Role {self.name} ({self.scope})>"
