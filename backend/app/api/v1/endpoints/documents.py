"""
Document Management API Endpoints for ARIA.
Provides upload, search, multi-versioning, lifecycle state transitions, download, and deletion.
"""

from pathlib import Path
from typing import Optional, Tuple
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    DBSession,
    get_current_user,
    get_document_with_access,
    get_project_and_membership,
    require_roles,
)
from app.models.document import Document, DocumentVersion
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.document import (
    DocumentDetailResponse,
    DocumentListItemResponse,
    DocumentListResponse,
)
from app.services.document.manager import document_manager
from app.services.document.storage import storage_service

router = APIRouter(tags=["Documents"])


@router.post(
    "/projects/{project_id}/documents/upload",
    response_model=DocumentDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload new document to project",
    description="Uploads a file, verifies project membership, creates Document and initial Version (v1).",
)
async def upload_document(
    project_id: uuid.UUID,
    file: UploadFile = File(..., description="Document binary (.pdf, .docx, .txt, .md, etc.)"),
    title: str = Form(..., description="Document title"),
    description: Optional[str] = Form(None, description="Document description / summary"),
    doc_type: str = Form("other", description="Document type: manual, spec, faq, guide, annotation_schema, other"),
    department_id: Optional[uuid.UUID] = Form(None, description="Department ID"),
    author: Optional[str] = Form(None, description="Author name"),
    confidentiality: str = Form("internal", description="Confidentiality: public, internal, confidential, restricted"),
    language: str = Form("en", description="Language code"),
    context: Tuple[Project, Optional[ProjectMember]] = Depends(get_project_and_membership),
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> DocumentDetailResponse:
    """Handle multipart document upload and initialize version 1."""
    project, _ = context

    # Read binary bytes
    file_bytes = await file.read()

    doc_detail = await document_manager.create_document(
        db=db,
        current_user=current_user,
        project=project,
        title=title,
        file=file,
        file_bytes=file_bytes,
        description=description,
        doc_type_str=doc_type,
        department_id=department_id,
        author=author,
        confidentiality=confidentiality,
        language=language,
    )

    return doc_detail


@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List & search documents",
    description="Search documents across accessible projects with multi-criteria filtering.",
)
async def list_and_search_documents(
    q: Optional[str] = Query(None, description="Full-text search query across title, description, and author"),
    project_id: Optional[uuid.UUID] = Query(None, description="Filter by project"),
    department_id: Optional[uuid.UUID] = Query(None, description="Filter by department"),
    status: Optional[str] = Query(None, description="Filter by status: UPLOADED, PROCESSING, READY, FAILED, ARCHIVED"),
    doc_type: Optional[str] = Query(None, description="Filter by doc_type: manual, spec, faq, guide, annotation_schema, other"),
    confidentiality: Optional[str] = Query(None, description="Filter by confidentiality: public, internal, confidential, restricted"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> DocumentListResponse:
    """List and search documents with tenant and project RBAC boundaries."""
    return await document_manager.list_and_search_documents(
        db=db,
        current_user=current_user,
        q=q,
        project_id=project_id,
        department_id=department_id,
        status_filter=status,
        doc_type_filter=doc_type,
        confidentiality_filter=confidentiality,
        page=page,
        limit=limit,
    )


@router.get(
    "/documents/summary/stats",
    summary="Get live document and chunk statistics",
    description="Returns aggregate counts of uploaded documents and indexed chunks for the dashboard.",
)
async def get_document_stats(
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
):
    from sqlalchemy import func
    from app.models.document import DocumentChunk
    
    doc_res = await db.execute(select(func.count(Document.id)))
    total_docs = doc_res.scalar() or 0
    
    chunk_res = await db.execute(select(func.count(DocumentChunk.id)))
    total_chunks = chunk_res.scalar() or 0
    
    return {
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "rag_status": "Active",
    }


@router.get(
    "/documents/{document_id}",
    response_model=DocumentDetailResponse,
    summary="Get document details & version history",
    description="Returns complete metadata and list of all historical versions.",
)
async def get_document_details(
    context: Tuple[Document, Project] = Depends(get_document_with_access),
    db: DBSession = None,
) -> DocumentDetailResponse:
    """Fetch single document metadata after validating project membership."""
    doc, _ = context
    return await document_manager.get_document_detail(db=db, doc_id=doc.id)


@router.post(
    "/documents/{document_id}/versions",
    response_model=DocumentDetailResponse,
    summary="Upload new version for document",
    description="Uploads a new version (v2, v3...), sets it as current, and retains version history.",
)
async def upload_new_version(
    document_id: uuid.UUID,
    file: UploadFile = File(..., description="Updated document binary"),
    change_summary: Optional[str] = Form(None, description="Summary of changes in this version"),
    context: Tuple[Document, Project] = Depends(get_document_with_access),
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> DocumentDetailResponse:
    """Upload a new version for an existing document."""
    doc, _ = context
    file_bytes = await file.read()

    return await document_manager.add_new_version(
        db=db,
        current_user=current_user,
        document=doc,
        file=file,
        file_bytes=file_bytes,
        change_summary=change_summary,
    )


@router.patch(
    "/documents/{document_id}/archive",
    response_model=DocumentDetailResponse,
    summary="Toggle document archive status",
    description="Archives or unarchives a document.",
)
async def archive_document(
    document_id: uuid.UUID,
    archive: bool = Query(True, description="True to archive, False to unarchive"),
    context: Tuple[Document, Project] = Depends(get_document_with_access),
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> DocumentDetailResponse:
    """Toggle document ARCHIVED state."""
    doc, _ = context
    return await document_manager.toggle_archive_document(db=db, doc=doc, archive=archive)


@router.delete(
    "/documents/{document_id}",
    summary="Delete document",
    description="Deletes document, all version records, and physical storage files.",
)
async def delete_document(
    document_id: uuid.UUID,
    context: Tuple[Document, Project] = Depends(get_document_with_access),
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
):
    """Delete document and physical files."""
    doc, _ = context
    return await document_manager.delete_document(db=db, doc=doc)


@router.get(
    "/documents/{document_id}/download",
    summary="Download document file",
    description="Securely download the active version or a specific version file.",
)
async def download_document_file(
    document_id: uuid.UUID,
    version_number: Optional[int] = Query(None, description="Specific version number (defaults to current)"),
    context: Tuple[Document, Project] = Depends(get_document_with_access),
    db: DBSession = None,
):
    """Stream file binary for download."""
    doc, _ = context

    # Find requested version or current version
    stmt = select(DocumentVersion).where(DocumentVersion.document_id == doc.id)
    if version_number:
        stmt = stmt.where(DocumentVersion.version_number == version_number)
    else:
        stmt = stmt.where(DocumentVersion.is_current == True)

    res = await db.execute(stmt)
    v = res.scalar_one_or_none()

    if not v:
        # Fallback to latest version
        stmt_latest = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == doc.id)
            .order_by(DocumentVersion.version_number.desc())
        )
        res_latest = await db.execute(stmt_latest)
        v = res_latest.scalar_one_or_none()

    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No storage file found for this document.")

    file_path = storage_service.get_file_path(v.storage_path)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Physical file at '{v.storage_path}' is not accessible on storage disk.",
        )

    download_name = f"{doc.title}{Path(v.storage_path).suffix}"
    return FileResponse(
        path=file_path,
        media_type=doc.mime_type or "application/octet-stream",
        filename=download_name,
    )
