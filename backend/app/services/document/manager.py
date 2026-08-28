"""
Document Manager Service for ARIA Document Management System.
Handles document creation, multi-versioning, lifecycle state transitions, search, and deletion.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.department import Department
from app.models.document import DocStatus, DocType, Document, DocumentVersion
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.document import (
    DocumentDetailResponse,
    DocumentListItemResponse,
    DocumentListResponse,
    DocumentVersionResponse,
)
from app.services.document.ingestion import process_and_embed_document
from app.services.document.storage import storage_service


def _get_current_version(doc: Document) -> Optional[DocumentVersion]:
    """Find the current active version, prioritizing highest version number with is_current=True."""
    if not doc.versions:
        return None
    sorted_v = sorted(doc.versions, key=lambda v: v.version_number, reverse=True)
    for v in sorted_v:
        if v.is_current:
            return v
    return sorted_v[0]


def _format_doc_list_item(doc: Document) -> DocumentListItemResponse:
    """Format Document ORM entity into DocumentListItemResponse."""
    cur_v = _get_current_version(doc)
    return DocumentListItemResponse(
        id=doc.id,
        title=doc.title,
        description=doc.description,
        project_id=doc.project_id,
        project_name=doc.project.name if doc.project else None,
        department_id=doc.department_id,
        department_name=doc.department.name if doc.department else None,
        doc_type=doc.doc_type.value if hasattr(doc.doc_type, "value") else str(doc.doc_type),
        current_version_number=cur_v.version_number if cur_v else 1,
        status=doc.status.value if hasattr(doc.status, "value") else str(doc.status),
        confidentiality=doc.confidentiality,
        author=doc.author,
        uploaded_by=doc.uploaded_by,
        uploaded_by_name=doc.uploader.name if doc.uploader else None,
        file_size_bytes=doc.file_size_bytes or (cur_v.file_size_bytes if cur_v else None),
        mime_type=doc.mime_type,
        page_count=doc.page_count,
        language=doc.language,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def _format_doc_detail(doc: Document, versions_list: Optional[List[DocumentVersion]] = None) -> DocumentDetailResponse:
    """Format Document ORM entity into full DocumentDetailResponse with version timeline."""
    versions = versions_list if versions_list is not None else doc.versions
    versions_sorted = sorted(versions, key=lambda v: v.version_number, reverse=True)
    
    cur_v = None
    for v in versions_sorted:
        if v.is_current:
            cur_v = v
            break
    if not cur_v and versions_sorted:
        cur_v = versions_sorted[0]

    version_items = [
        DocumentVersionResponse(
            id=v.id,
            version_number=v.version_number,
            storage_path=v.storage_path,
            file_size_bytes=v.file_size_bytes,
            checksum=v.checksum,
            change_summary=v.change_summary,
            created_by=v.created_by,
            created_by_name=v.author.name if v.author else None,
            created_at=v.created_at,
            is_current=v.is_current,
        )
        for v in versions_sorted
    ]

    return DocumentDetailResponse(
        id=doc.id,
        title=doc.title,
        description=doc.description,
        project_id=doc.project_id,
        project_name=doc.project.name if doc.project else None,
        department_id=doc.department_id,
        department_name=doc.department.name if doc.department else None,
        doc_type=doc.doc_type.value if hasattr(doc.doc_type, "value") else str(doc.doc_type),
        current_version_number=cur_v.version_number if cur_v else 1,
        status=doc.status.value if hasattr(doc.status, "value") else str(doc.status),
        confidentiality=doc.confidentiality,
        author=doc.author,
        uploaded_by=doc.uploaded_by,
        uploaded_by_name=doc.uploader.name if doc.uploader else None,
        file_size_bytes=doc.file_size_bytes or (cur_v.file_size_bytes if cur_v else None),
        mime_type=doc.mime_type,
        page_count=doc.page_count,
        language=doc.language,
        versions=version_items,
        metadata=doc.metadata_ or {},
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


class DocumentManager:
    """Core domain service for Document Management."""

    @staticmethod
    async def create_document(
        db: AsyncSession,
        current_user: User,
        project: Project,
        title: str,
        file: UploadFile,
        file_bytes: bytes,
        description: Optional[str] = None,
        doc_type_str: str = "other",
        department_id: Optional[uuid.UUID] = None,
        author: Optional[str] = None,
        confidentiality: str = "internal",
        language: str = "en",
    ) -> DocumentDetailResponse:
        """
        Uploads a new document, creates Document + DocumentVersion (v1),
        and stores the physical file in storage.
        """
        # 1. Validate file
        clean_name, mime_type, file_size = storage_service.validate_file(file, file_bytes)
        checksum = storage_service.calculate_checksum(file_bytes)

        # 2. Parse doc_type enum
        try:
            doc_type = DocType(doc_type_str.lower())
        except ValueError:
            doc_type = DocType.other

        # 3. Create Document instance in READY state
        doc_id = uuid.uuid4()
        document = Document(
            id=doc_id,
            project_id=project.id,
            organization_id=project.organization_id,
            department_id=department_id,
            uploaded_by=current_user.id,
            title=title.strip() or clean_name,
            description=description.strip() if description else None,
            author=author.strip() if author else current_user.name,
            doc_type=doc_type,
            status=DocStatus.ready,
            confidentiality=confidentiality or "internal",
            file_size_bytes=file_size,
            mime_type=mime_type,
            language=language or "en",
            metadata_={
                "original_filename": file.filename,
                "initial_checksum": checksum,
            },
        )
        db.add(document)
        await db.flush()

        # 4. Save physical file to storage
        storage_path = await storage_service.save_document_file(
            org_id=project.organization_id,
            project_id=project.id,
            doc_id=doc_id,
            version_number=1,
            filename=clean_name,
            file_bytes=file_bytes,
        )

        # 5. Create initial DocumentVersion (v1)
        version_1 = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc_id,
            created_by=current_user.id,
            version_number=1,
            storage_path=storage_path,
            file_size_bytes=file_size,
            checksum=checksum,
            change_summary="Initial document upload",
            is_current=True,
        )
        db.add(version_1)
        await db.commit()

        # 6. Extract text, generate chunks, compute BGE-M3 embeddings, and save to pgvector
        await process_and_embed_document(
            db=db,
            document=document,
            version=version_1,
            file_bytes=file_bytes,
            filename=clean_name,
            mime_type=mime_type,
        )

        # 7. Re-query and return fresh document detail
        return await DocumentManager.get_document_detail(db=db, doc_id=doc_id)

    @staticmethod
    async def add_new_version(
        db: AsyncSession,
        current_user: User,
        document: Document,
        file: UploadFile,
        file_bytes: bytes,
        change_summary: Optional[str] = None,
    ) -> DocumentDetailResponse:
        """
        Uploads a new version for an existing document.
        Deactivates previous current versions, increments version_number,
        and saves the new version binary.
        """
        # 1. Validate file
        clean_name, mime_type, file_size = storage_service.validate_file(file, file_bytes)
        checksum = storage_service.calculate_checksum(file_bytes)

        # 2. Determine next version number
        stmt_versions = select(DocumentVersion).where(DocumentVersion.document_id == document.id)
        res_v = await db.execute(stmt_versions)
        existing_versions = res_v.scalars().all()

        max_version = 0
        for v in existing_versions:
            if v.version_number > max_version:
                max_version = v.version_number
            # Mark all old versions as not current
            v.is_current = False

        next_version = max_version + 1

        doc_id = document.id
        org_id = document.organization_id
        proj_id = document.project_id

        # 3. Save physical file to storage
        storage_path = await storage_service.save_document_file(
            org_id=org_id,
            project_id=proj_id,
            doc_id=doc_id,
            version_number=next_version,
            filename=clean_name,
            file_bytes=file_bytes,
        )

        # 4. Insert new version record
        new_version = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc_id,
            created_by=current_user.id,
            version_number=next_version,
            storage_path=storage_path,
            file_size_bytes=file_size,
            checksum=checksum,
            change_summary=change_summary.strip() if change_summary else f"Version {next_version} update",
            is_current=True,
        )
        db.add(new_version)

        # 5. Update parent document attributes
        document.file_size_bytes = file_size
        document.mime_type = mime_type
        document.status = DocStatus.ready
        document.updated_at = datetime.now(timezone.utc)

        await db.commit()

        # 6. Extract text and embed new version chunks
        await process_and_embed_document(
            db=db,
            document=document,
            version=new_version,
            file_bytes=file_bytes,
            filename=clean_name,
            mime_type=mime_type,
        )

        # 7. Return fresh document detail
        return await DocumentManager.get_document_detail(db=db, doc_id=doc_id)

    @staticmethod
    async def list_and_search_documents(
        db: AsyncSession,
        current_user: User,
        q: Optional[str] = None,
        project_id: Optional[uuid.UUID] = None,
        department_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None,
        doc_type_filter: Optional[str] = None,
        confidentiality_filter: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> DocumentListResponse:
        """
        Multi-criteria search and catalog filtering with tenant and project RBAC isolation.
        """
        user_role = current_user.role.name.upper() if current_user.role else "VIEWER"

        stmt = (
            select(Document)
            .options(
                selectinload(Document.project),
                selectinload(Document.department),
                selectinload(Document.uploader),
                selectinload(Document.versions),
            )
        )

        # Organization boundary check
        if user_role != "SUPER_ADMIN":
            stmt = stmt.where(Document.organization_id == current_user.organization_id)

            # If user is not Admin/Manager, restrict to assigned projects
            if user_role not in ("ADMIN", "MANAGER"):
                subq = select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
                stmt = stmt.where(Document.project_id.in_(subq))

        # Query filter
        if q and q.strip():
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Document.title.ilike(term),
                    Document.description.ilike(term),
                    Document.author.ilike(term),
                )
            )

        # Project filter
        if project_id:
            stmt = stmt.where(Document.project_id == project_id)

        # Department filter
        if department_id:
            stmt = stmt.where(Document.department_id == department_id)

        # Status filter
        if status_filter and status_filter.strip():
            try:
                st = DocStatus(status_filter.strip().upper())
                stmt = stmt.where(Document.status == st)
            except ValueError:
                pass

        # DocType filter
        if doc_type_filter and doc_type_filter.strip():
            try:
                dt = DocType(doc_type_filter.strip().lower())
                stmt = stmt.where(Document.doc_type == dt)
            except ValueError:
                pass

        # Confidentiality filter
        if confidentiality_filter and confidentiality_filter.strip():
            stmt = stmt.where(Document.confidentiality == confidentiality_filter.strip().lower())

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Pagination & ordering
        offset = max(0, (page - 1) * limit)
        stmt = stmt.order_by(Document.updated_at.desc()).offset(offset).limit(limit)

        result = await db.execute(stmt)
        docs = result.scalars().all()

        items = [_format_doc_list_item(d) for d in docs]
        return DocumentListResponse(items=items, total=total, page=page, limit=limit)

    @staticmethod
    async def get_document_detail(
        db: AsyncSession,
        doc_id: uuid.UUID,
    ) -> DocumentDetailResponse:
        """Fetch full document details with all versions."""
        stmt = (
            select(Document)
            .where(Document.id == doc_id)
            .options(
                selectinload(Document.project),
                selectinload(Document.department),
                selectinload(Document.uploader),
            )
        )
        res = await db.execute(stmt)
        doc = res.scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

        # Explicitly query all versions for this document sorted by version_number desc
        stmt_versions = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == doc_id)
            .options(selectinload(DocumentVersion.author))
            .order_by(DocumentVersion.version_number.desc())
        )
        res_v = await db.execute(stmt_versions)
        all_versions = res_v.scalars().all()

        return _format_doc_detail(doc, all_versions)

    @staticmethod
    async def toggle_archive_document(
        db: AsyncSession,
        doc: Document,
        archive: bool = True,
    ) -> DocumentDetailResponse:
        """Toggle document ARCHIVED status."""
        doc.status = DocStatus.archived if archive else DocStatus.ready
        doc.updated_at = datetime.now(timezone.utc)
        await db.commit()

        stmt = (
            select(Document)
            .where(Document.id == doc.id)
            .options(
                selectinload(Document.project),
                selectinload(Document.department),
                selectinload(Document.uploader),
                selectinload(Document.versions).selectinload(DocumentVersion.author),
            )
        )
        res = await db.execute(stmt)
        refreshed = res.scalar_one()
        return _format_doc_detail(refreshed)

    @staticmethod
    async def delete_document(
        db: AsyncSession,
        doc: Document,
    ) -> Dict[str, Any]:
        """Delete document from database and delete physical storage files."""
        # 1. Delete physical storage files
        storage_service.delete_document_files(
            org_id=doc.organization_id,
            project_id=doc.project_id,
            doc_id=doc.id,
        )

        # 2. Delete database record
        doc_id = doc.id
        doc_title = doc.title
        await db.delete(doc)
        await db.commit()

        return {
            "success": True,
            "deleted_id": str(doc_id),
            "title": doc_title,
            "message": "Document and all version files successfully deleted.",
        }


document_manager = DocumentManager()
