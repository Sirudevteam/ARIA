"""
Document endpoints with project-level access control.
"""

from typing import Tuple
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DBSession, get_document_with_access
from app.models.document import Document
from app.models.project import Project
from app.schemas.auth import DocumentSummaryResponse

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get(
    "/{document_id}",
    response_model=DocumentSummaryResponse,
    summary="Get document details",
    description="Validates project membership before returning document metadata.",
)
async def get_document_by_id(
    context: Tuple[Document, Project] = Depends(get_document_with_access),
) -> DocumentSummaryResponse:
    """Fetch single document metadata after validating project membership."""
    doc, _ = context

    return DocumentSummaryResponse(
        id=doc.id,
        project_id=doc.project_id,
        organization_id=doc.organization_id,
        title=doc.title,
        description=doc.description,
        doc_type=doc.doc_type.value if hasattr(doc.doc_type, "value") else str(doc.doc_type),
        status=doc.status.value if hasattr(doc.status, "value") else str(doc.status),
        source_url=doc.source_url,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        page_count=doc.page_count,
        language=doc.language,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )
