"""
Domain Embedding Service for ARIA.
Coordinates batch embedding generation, SHA-256 deduplication, model version tracking,
pgvector persistence, and re-embedding workflows.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.document import ChunkStatus, DocStatus, Document, DocumentChunk
from app.services.embedding.base import BaseEmbeddingProvider
from app.services.embedding.factory import get_embedding_provider

settings = get_settings()


class EmbeddingService:
    """
    High-level embedding orchestrator with deduplication, batching,
    model version tracking, and pgvector persistence.
    """

    def __init__(self, provider: Optional[BaseEmbeddingProvider] = None):
        self._provider = provider or get_embedding_provider()

    @property
    def provider(self) -> BaseEmbeddingProvider:
        return self._provider

    def set_provider(self, provider: BaseEmbeddingProvider) -> None:
        """Allow runtime swapping of the active embedding provider."""
        self._provider = provider

    async def embed_document_chunks(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        chunks: List[DocumentChunk],
        force: bool = False,
        batch_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Embeds a list of DocumentChunks with content-hash deduplication and batching.
        Updates PostgreSQL pgvector columns and chunk metadata.
        """
        if not chunks:
            return {"total": 0, "embedded": 0, "skipped": 0, "model": self._provider.get_model_identifier()}

        effective_batch_size = batch_size or settings.EMBEDDING_BATCH_SIZE
        model_id = self._provider.get_model_identifier()

        to_embed: List[Tuple[DocumentChunk, str]] = []
        skipped_count = 0

        # 1. Deduplication check using SHA-256 content hash and model identifier
        for chunk in chunks:
            c_hash = self._provider.compute_content_hash(chunk.content)
            cur_meta = dict(chunk.metadata_ or {})
            cur_model = cur_meta.get("embedding_model")
            cur_hash = cur_meta.get("content_hash")

            is_already_embedded = (
                chunk.status == ChunkStatus.embedded
                and chunk.embedding is not None
                and cur_hash == c_hash
                and cur_model == model_id
            )

            if is_already_embedded and not force:
                skipped_count += 1
            else:
                to_embed.append((chunk, c_hash))

        # 2. Batch embedding execution
        embedded_count = 0
        if to_embed:
            # Process in batches
            for i in range(0, len(to_embed), effective_batch_size):
                batch = to_embed[i : i + effective_batch_size]
                batch_texts = [item[0].content for item in batch]

                vectors = await self._provider.embed_texts(batch_texts)

                now_iso = datetime.now(timezone.utc).isoformat()
                for (chunk, c_hash), vec in zip(batch, vectors):
                    chunk.embedding = vec
                    chunk.status = ChunkStatus.embedded
                    meta = dict(chunk.metadata_ or {})
                    meta.update({
                        "content_hash": c_hash,
                        "embedding_model": model_id,
                        "embedding_dimensions": self._provider.dimensions,
                        "embedded_at": now_iso,
                    })
                    chunk.metadata_ = meta
                    embedded_count += 1

        # 3. Update parent document metadata
        stmt = select(Document).where(Document.id == document_id)
        res = await db.execute(stmt)
        doc = res.scalar_one_or_none()
        if doc:
            doc_meta = dict(doc.metadata_ or {})
            doc_meta["active_embedding_model"] = model_id
            doc_meta["embedded_chunk_count"] = len(chunks)
            doc_meta["last_embedded_at"] = datetime.now(timezone.utc).isoformat()
            doc.metadata_ = doc_meta
            doc.status = DocStatus.ready

        # 4. Synchronize points with Qdrant Vector DB
        try:
            from app.services.vector_db.qdrant_service import qdrant_service
            qdrant_payloads = []
            for chunk in chunks:
                if chunk.embedding is not None:
                    qdrant_payloads.append({
                        "chunk_id": chunk.id,
                        "document_id": document_id,
                        "organization_id": doc.organization_id if doc else None,
                        "project_id": doc.project_id if doc else None,
                        "department_id": doc.department_id if doc else None,
                        "confidentiality": doc.confidentiality if doc else "INTERNAL",
                        "doc_type": doc.doc_type if doc else "OTHER",
                        "document_title": doc.title if doc else "",
                        "chunk_index": chunk.chunk_index,
                        "page_number": chunk.page_number,
                        "token_count": chunk.token_count,
                        "content": chunk.content,
                        "dense_embedding": chunk.embedding,
                        "metadata": chunk.metadata_ or {},
                    })
            if qdrant_payloads:
                await qdrant_service.upsert_chunks(qdrant_payloads)
        except Exception:
            pass

        await db.commit()

        return {
            "total_chunks": len(chunks),
            "embedded_count": embedded_count,
            "skipped_count": skipped_count,
            "embedding_model": model_id,
            "dimensions": self._provider.dimensions,
        }

    async def reembed_document(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
        force: bool = True,
    ) -> Dict[str, Any]:
        """
        Re-embed all chunks for a document (e.g. when model version changes or on admin trigger).
        """
        stmt = (
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index.asc())
        )
        res = await db.execute(stmt)
        chunks = res.scalars().all()

        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No chunks found for this document. Please ensure document is parsed first.",
            )

        return await self.embed_document_chunks(
            db=db,
            document_id=document_id,
            chunks=list(chunks),
            force=force,
        )

    async def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding vector for a search query string using the active provider.
        """
        if not query or not query.strip():
            return [0.0] * self._provider.dimensions
        return await self._provider.embed_query(query.strip())


# Singleton domain service instance
embedding_service = EmbeddingService()
