"""
Import all models here so SQLAlchemy registers them with the metadata.
This file must be imported before any Alembic autogenerate or table creation.
"""

from app.models.base import Base, TimestampMixin, UUIDMixin  # noqa: F401
from app.models.organization import Organization              # noqa: F401
from app.models.department import Department                  # noqa: F401
from app.models.role import Role, RoleScope                  # noqa: F401
from app.models.user import User, UserStatus                 # noqa: F401
from app.models.team import Team                                # noqa: F401
from app.models.project import Project, ProjectMember, ProjectStatus  # noqa: F401
from app.models.document import (                            # noqa: F401
    Document, DocumentVersion, DocumentChunk,
    DocStatus, DocType, ChunkStatus,
)
from app.models.conversation import (                        # noqa: F401
    Conversation, Message, MessageSource,
    ConversationStatus, MessageRole,
)
from app.models.feedback import (                            # noqa: F401
    Feedback, AuditLog, FeedbackRating, AuditAction,
)

__all__ = [
    "Base", "TimestampMixin", "UUIDMixin",
    "Organization",
    "Department",
    "Role", "RoleScope",
    "User", "UserStatus",
    "Team",
    "Project", "ProjectMember", "ProjectStatus",
    "Document", "DocumentVersion", "DocumentChunk",
    "DocStatus", "DocType", "ChunkStatus",
    "Conversation", "Message", "MessageSource",
    "ConversationStatus", "MessageRole",
    "Feedback", "AuditLog", "FeedbackRating", "AuditAction",
]
