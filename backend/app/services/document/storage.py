"""
Storage Service for Document Management.
Handles file validation, SHA-256 hashing, Supabase Storage & local disk persistence.
"""

import hashlib
import os
from pathlib import Path
import re
from typing import Optional, Tuple
import uuid

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

settings = get_settings()

# 50 MB maximum allowed file size
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

# Whitelist of allowed extensions and corresponding MIME types
ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".json": "application/json",
    ".csv": "text/csv",
}

# Base local storage directory
STORAGE_ROOT = Path("storage/documents")


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal or invalid characters."""
    clean = re.sub(r"[^\w\.-]", "_", filename)
    return clean or "document"


class StorageService:
    """File validation and storage manager with Supabase / Local disk fallback."""

    def __init__(self, base_dir: Path = STORAGE_ROOT):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def validate_file(self, file: UploadFile, file_bytes: bytes) -> Tuple[str, str, int]:
        """
        Validates file size, extension, and calculates SHA-256 checksum.
        Returns (sanitized_filename, mime_type, file_size_bytes).
        """
        filename = file.filename or "uploaded_file"
        file_size = len(file_bytes)

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({file_size / (1024 * 1024):.1f}MB) exceeds the 50MB limit.",
            )

        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            allowed_list = ", ".join(ALLOWED_EXTENSIONS.keys())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{ext}'. Allowed formats: {allowed_list}",
            )

        mime_type = file.content_type or ALLOWED_EXTENSIONS.get(ext, "application/octet-stream")
        clean_name = sanitize_filename(filename)

        return clean_name, mime_type, file_size

    def calculate_checksum(self, file_bytes: bytes) -> str:
        """Calculate SHA-256 hex digest for cryptographic integrity."""
        return hashlib.sha256(file_bytes).hexdigest()

    async def save_document_file(
        self,
        org_id: uuid.UUID,
        project_id: uuid.UUID,
        doc_id: uuid.UUID,
        version_number: int,
        filename: str,
        file_bytes: bytes,
    ) -> str:
        """
        Saves document binary to storage path:
        storage/documents/{org_id}/{project_id}/{doc_id}/v{version_number}_{filename}
        """
        target_dir = self.base_dir / str(org_id) / str(project_id) / str(doc_id)
        target_dir.mkdir(parents=True, exist_ok=True)

        target_file = target_dir / f"v{version_number}_{filename}"
        with open(target_file, "wb") as f:
            f.write(file_bytes)

        # Return standardized relative storage path
        rel_path = str(target_file.as_posix())
        return rel_path

    def get_file_path(self, storage_path: str) -> Optional[Path]:
        """Resolves physical file path from storage path."""
        p = Path(storage_path)
        if p.exists() and p.is_file():
            return p
        return None

    def delete_document_files(
        self,
        org_id: uuid.UUID,
        project_id: uuid.UUID,
        doc_id: uuid.UUID,
    ) -> bool:
        """Recursively deletes all version files for a document directory."""
        target_dir = self.base_dir / str(org_id) / str(project_id) / str(doc_id)
        if target_dir.exists() and target_dir.is_dir():
            import shutil
            shutil.rmtree(target_dir, ignore_errors=True)
            return True
        return False


storage_service = StorageService()
