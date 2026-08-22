"""
Pydantic schemas for Document Management System (CRUD, Versioning, Metadata, Search).
"""

from datetime import datetime
import json
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DocumentVersionResponse(BaseModel):
    """Document Version details."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version_number: int
    storage_path: str
    file_size_bytes: Optional[int] = None
    checksum: Optional[str] = None
    change_summary: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    is_current: bool


class DocumentListItemResponse(BaseModel):
    """Document summary for catalogs, tables, and search results."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: Optional[str] = None
    project_id: uuid.UUID
    project_name: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    doc_type: str
    current_version_number: int = 1
    status: str
    confidentiality: str
    author: Optional[str] = None
    uploaded_by: Optional[uuid.UUID] = None
    uploaded_by_name: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    page_count: Optional[int] = None
    language: str = "en"
    created_at: datetime
    updated_at: datetime

    @field_validator("doc_type", "status", "confidentiality", mode="before")
    @classmethod
    def parse_enum_fields(cls, v: Any) -> str:
        if hasattr(v, "value"):
            return str(v.value)
        return str(v)


class DocumentDetailResponse(DocumentListItemResponse):
    """Full document detail view with version history and metadata."""

    versions: List[DocumentVersionResponse] = Field(default_factory=list)
    metadata_: Dict[str, Any] = Field(default_factory=dict, alias="metadata")

    @field_validator("metadata_", mode="before")
    @classmethod
    def parse_metadata(cls, v: Any) -> Dict[str, Any]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return dict(v) if v is not None else {}


class DocumentListResponse(BaseModel):
    """Paginated or listed document results with count metadata."""

    items: List[DocumentListItemResponse]
    total: int
    page: int = 1
    limit: int = 50


class DepartmentResponse(BaseModel):
    """Department metadata for organizational assignment."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: Optional[str] = None
