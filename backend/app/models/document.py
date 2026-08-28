"""
Document, DocumentVersion, and DocumentChunk models with multi-version lifecycle support.
"""

import enum
from typing import TYPE_CHECKING, Optional
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.conversation import MessageSource
    from app.models.department import Department
    from app.models.organization import Organization
    from app.models.project import Project
    from app.models.user import User


class DocStatus(str, enum.Enum):
    uploaded = "UPLOADED"
    processing = "PROCESSING"
    ready = "READY"
    failed = "FAILED"
    archived = "ARCHIVED"


class DocType(str, enum.Enum):
    manual = "manual"
    spec = "spec"
    faq = "faq"
    guide = "guide"
    annotation_schema = "annotation_schema"
    other = "other"


class ConfidentialityLevel(str, enum.Enum):
    public = "public"
    internal = "internal"
    confidential = "confidential"
    restricted = "restricted"


class ChunkStatus(str, enum.Enum):
    pending = "pending"
    embedded = "embedded"
    failed = "failed"


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    author: Mapped[str] = mapped_column(String, nullable=True)
    doc_type: Mapped[DocType] = mapped_column(
        Enum(DocType, name="doc_type"), default=DocType.other, nullable=False
    )
    status: Mapped[DocStatus] = mapped_column(
        Enum(DocStatus, name="doc_status"), default=DocStatus.uploaded, nullable=False
    )
    confidentiality: Mapped[str] = mapped_column(String, default="internal", nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str] = mapped_column(String, nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, nullable=True)
    language: Mapped[str] = mapped_column(String, default="en", nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    @property
    def source_url(self) -> Optional[str]:
        return self.metadata_.get("source_url") if self.metadata_ else None

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="documents")
    organization: Mapped["Organization"] = relationship()
    department: Mapped["Department"] = relationship()
    uploader: Mapped["User"] = relationship()
    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="DocumentVersion.version_number"
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="DocumentChunk.chunk_index"
    )

    @property
    def current_version(self) -> Optional["DocumentVersion"]:
        for v in self.versions:
            if v.is_current:
                return v
        return self.versions[-1] if self.versions else None

    def __repr__(self) -> str:
        return f"<Document {self.title} ({self.status.value if hasattr(self.status, 'value') else self.status})>"


class DocumentVersion(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "document_versions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=True)
    checksum: Mapped[str] = mapped_column(String, nullable=True)
    change_summary: Mapped[str] = mapped_column(Text, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="versions")
    author: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<DocumentVersion doc={self.document_id} v={self.version_number} current={self.is_current}>"


class DocumentChunk(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "document_chunks"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    document_version_id: Mapped[uuid.UUID] = mapped_column(
        "document_version_id", UUID(as_uuid=True), ForeignKey("document_versions.id", ondelete="SET NULL"), nullable=True
    )

    @property
    def version_id(self) -> Optional[uuid.UUID]:
        return self.document_version_id

    @version_id.setter
    def version_id(self, value: Optional[uuid.UUID]) -> None:
        self.document_version_id = value
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[ChunkStatus] = mapped_column(
        Enum(ChunkStatus, name="chunk_status"), default=ChunkStatus.pending, nullable=False
    )
    # 1024-dimensional embedding vector for BGE-M3 in pgvector
    embedding: Mapped[list[float]] = mapped_column(Vector(1024), nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="chunks")
    version: Mapped["DocumentVersion"] = relationship(foreign_keys=[document_version_id])
    sources: Mapped[list["MessageSource"]] = relationship(back_populates="chunk")
