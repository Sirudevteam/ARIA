"""
Document, DocumentVersion, and DocumentChunk models.
"""

import enum

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class DocStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    indexed = "indexed"
    failed = "failed"
    archived = "archived"


class DocType(str, enum.Enum):
    manual = "manual"
    spec = "spec"
    faq = "faq"
    guide = "guide"
    annotation_schema = "annotation_schema"
    other = "other"


class ChunkStatus(str, enum.Enum):
    pending = "pending"
    embedded = "embedded"
    failed = "failed"


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    doc_type: Mapped[DocType] = mapped_column(
        Enum(DocType, name="doc_type"), default=DocType.other, nullable=False
    )
    status: Mapped[DocStatus] = mapped_column(
        Enum(DocStatus, name="doc_status"), default=DocStatus.pending, nullable=False
    )
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="documents")
    versions: Mapped[list["DocumentVersion"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Document {self.title}>"


class DocumentVersion(Base, UUIDMixin):
    __tablename__ = "document_versions"

    document_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    checksum: Mapped[str | None] = mapped_column(String, nullable=True)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    from app.models.base import TimestampMixin
    from sqlalchemy import DateTime
    from sqlalchemy.orm import mapped_column as mc
    created_at: Mapped[str] = mapped_column(
        "created_at", __import__("sqlalchemy").DateTime(timezone=True),
        server_default=__import__("sqlalchemy").func.now(), nullable=False
    )

    document: Mapped["Document"] = relationship(back_populates="versions")


class DocumentChunk(Base, UUIDMixin):
    __tablename__ = "document_chunks"

    document_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    version_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_versions.id", ondelete="SET NULL"), nullable=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[ChunkStatus] = mapped_column(
        Enum(ChunkStatus, name="chunk_status"), default=ChunkStatus.pending, nullable=False
    )
    # 1536-dim vector for OpenAI/DeepSeek embeddings
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    from sqlalchemy import DateTime
    created_at: Mapped[str] = mapped_column(
        "created_at", __import__("sqlalchemy").DateTime(timezone=True),
        server_default=__import__("sqlalchemy").func.now(), nullable=False
    )

    document: Mapped["Document"] = relationship(back_populates="chunks")
    sources: Mapped[list["MessageSource"]] = relationship(back_populates="chunk")
