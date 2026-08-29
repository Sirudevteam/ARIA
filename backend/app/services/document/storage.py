"""
Storage Service for Document Management.
Handles file validation, SHA-256 hashing, Cloudflare R2 (S3-compatible) & local disk persistence.
"""

import hashlib
import io
import logging
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

logger = logging.getLogger(__name__)
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
    """File validation and object storage manager supporting Cloudflare R2 & Local disk."""

    def __init__(self, base_dir: Path = STORAGE_ROOT):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._s3_client = None
        self._init_r2_client()

    def _init_r2_client(self):
        """Initializes the boto3 S3 client for Cloudflare R2 if credentials exist."""
        if settings.R2_ACCESS_KEY_ID and settings.R2_SECRET_ACCESS_KEY and (settings.R2_ACCOUNT_ID or settings.R2_ENDPOINT_URL):
            endpoint = settings.R2_ENDPOINT_URL or f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
            try:
                self._s3_client = boto3.client(
                    "s3",
                    endpoint_url=endpoint,
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
                    region_name="auto",
                )
                logger.info(f"[STORAGE] Cloudflare R2 client initialized for bucket '{settings.R2_BUCKET_NAME}'")
            except Exception as e:
                logger.warning(f"[STORAGE] Failed to initialize Cloudflare R2 client: {e}. Falling back to local storage.")
                self._s3_client = None

    @property
    def is_r2_enabled(self) -> bool:
        """Returns True if Cloudflare R2 client is configured and active."""
        return self._s3_client is not None

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
        Saves document binary to Cloudflare R2 (and local mirror).
        Key: documents/{org_id}/{project_id}/{doc_id}/v{version_number}_{filename}
        """
        # Standard object key
        r2_key = f"documents/{org_id}/{project_id}/{doc_id}/v{version_number}_{filename}"

        # 1. Upload to Cloudflare R2 if configured
        if self._s3_client:
            try:
                self._s3_client.put_object(
                    Bucket=settings.R2_BUCKET_NAME,
                    Key=r2_key,
                    Body=file_bytes,
                    ContentType=ALLOWED_EXTENSIONS.get(Path(filename).suffix.lower(), "application/octet-stream"),
                )
                logger.info(f"[STORAGE] Uploaded document to Cloudflare R2: {r2_key}")
            except Exception as e:
                logger.error(f"[STORAGE] Cloudflare R2 upload error: {e}")

        # 2. Local disk mirror for instant vector embedding & extraction
        target_dir = self.base_dir / str(org_id) / str(project_id) / str(doc_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / f"v{version_number}_{filename}"
        with open(target_file, "wb") as f:
            f.write(file_bytes)

        # Standard relative storage path identifier
        return str(target_file.as_posix())

    def get_file_path(self, storage_path: str) -> Optional[Path]:
        """Resolves physical file path from storage path."""
        p = Path(storage_path)
        if p.exists() and p.is_file():
            return p
        return None

    def get_file_bytes(self, storage_path: str, org_id: Optional[uuid.UUID] = None, project_id: Optional[uuid.UUID] = None, doc_id: Optional[uuid.UUID] = None, filename: Optional[str] = None) -> bytes:
        """Retrieves binary content of a file from local disk or Cloudflare R2."""
        p = self.get_file_path(storage_path)
        if p:
            with open(p, "rb") as f:
                return f.read()

        # Fallback to Cloudflare R2
        if self._s3_client and org_id and project_id and doc_id and filename:
            try:
                r2_key = f"documents/{org_id}/{project_id}/{doc_id}/{filename}"
                obj = self._s3_client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
                return obj["Body"].read()
            except Exception as e:
                logger.error(f"[STORAGE] Error reading from Cloudflare R2: {e}")

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document binary not found.")

    def delete_document_files(
        self,
        org_id: uuid.UUID,
        project_id: uuid.UUID,
        doc_id: uuid.UUID,
    ) -> bool:
        """Deletes all version files for a document from Cloudflare R2 and local disk."""
        # 1. Delete from Cloudflare R2
        if self._s3_client:
            prefix = f"documents/{org_id}/{project_id}/{doc_id}/"
            try:
                paginator = self._s3_client.get_paginator("list_objects_v2")
                for page in paginator.paginate(Bucket=settings.R2_BUCKET_NAME, Prefix=prefix):
                    keys = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
                    if keys:
                        self._s3_client.delete_objects(
                            Bucket=settings.R2_BUCKET_NAME,
                            Delete={"Objects": keys},
                        )
                logger.info(f"[STORAGE] Purged document prefix from Cloudflare R2: {prefix}")
            except Exception as e:
                logger.warning(f"[STORAGE] Cloudflare R2 deletion warning: {e}")

        # 2. Delete local directory mirror
        target_dir = self.base_dir / str(org_id) / str(project_id) / str(doc_id)
        if target_dir.exists() and target_dir.is_dir():
            import shutil
            shutil.rmtree(target_dir, ignore_errors=True)
            return True
        return False


storage_service = StorageService()
