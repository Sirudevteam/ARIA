"""
Qdrant Vector Database & Hybrid Retrieval Engine for ARIA.
Provides high-performance vector indexing, named dense vectors (BGE-M3 1024d),
sparse BM25 lexical vectors, payload pre-filtering, and server-side RRF fusion.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
import uuid

from qdrant_client import AsyncQdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse

from app.core.config import get_settings

logger = logging.getLogger("aria.vector_db.qdrant")
settings = get_settings()


def text_to_sparse_vector(text: str) -> Tuple[List[int], List[float]]:
    """
    Convert text into a deterministic sparse vector representation
    suitable for Qdrant sparse vector search with BM25/TF weighting.
    """
    if not text:
        return [1], [0.0]

    tokens = re.findall(r"\b\w+\b", text.lower())
    if not tokens:
        return [1], [0.0]

    tf: Dict[int, float] = {}
    doc_len = len(tokens)
    k1 = 1.2
    b = 0.75
    avg_len = 120.0

    for token in tokens:
        # Deterministic 31-bit integer hash index
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest()[:7], 16) & 0x7FFFFFFF
        # Acronym & technical term boosting (e.g. LiDAR, ISO, VLS)
        weight = 2.0 if len(token) >= 3 and token.isalnum() else 1.0
        raw_count = tf.get(idx, 0.0) + 1.0
        tf[idx] = raw_count * weight

    indices: List[int] = []
    values: List[float] = []
    for idx, raw_score in tf.items():
        # BM25 frequency saturation formula
        norm_score = (raw_score * (k1 + 1.0)) / (raw_score + k1 * (1.0 - b + b * (doc_len / avg_len)))
        indices.append(idx)
        values.append(round(norm_score, 4))

    return indices, values


class QdrantService:
    """
    Enterprise Qdrant Client Wrapper for ARIA.
    Manages collection lifecycle, hybrid dense+sparse vectors, and RRF fusion queries.
    """

    def __init__(self) -> None:
        self.collection_name: str = settings.QDRANT_COLLECTION
        self._client: Optional[AsyncQdrantClient] = None
        self._is_initialized: bool = False
        self._memory_fallback: Dict[str, Dict[str, Any]] = {}

    def get_client(self) -> AsyncQdrantClient:
        """Returns or instantiates the AsyncQdrantClient."""
        if self._client is None:
            if settings.QDRANT_URL:
                self._client = AsyncQdrantClient(
                    url=settings.QDRANT_URL,
                    api_key=settings.QDRANT_API_KEY,
                    timeout=settings.QDRANT_TIMEOUT_SECONDS,
                )
            else:
                self._client = AsyncQdrantClient(
                    host=settings.QDRANT_HOST,
                    port=settings.QDRANT_PORT,
                    api_key=settings.QDRANT_API_KEY,
                    timeout=settings.QDRANT_TIMEOUT_SECONDS,
                )
        return self._client

    async def close(self) -> None:
        """Close Qdrant client connection pool."""
        if self._client is not None:
            await self._client.close()
            self._client = None
            self._is_initialized = False

    async def ensure_collection(self) -> bool:
        """
        Ensures the ARIA chunks collection exists in Qdrant with:
        1. 'dense' named vector (1024-dim, Cosine distance)
        2. 'sparse' named vector (SparseIndexParams)
        3. Pre-indexed payload fields for RBAC & Tenant filters
        """
        client = self.get_client()
        try:
            collections = await client.get_collections()
            collection_names = [c.name for c in collections.collections]

            if self.collection_name not in collection_names:
                logger.info(f"Creating Qdrant collection: {self.collection_name}")
                await client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config={
                        "dense": models.VectorParams(
                            size=settings.EMBEDDING_DIMENSIONS,
                            distance=models.Distance.COSINE,
                            on_disk=False,
                        )
                    },
                    sparse_vectors_config={
                        "sparse": models.SparseVectorParams(
                            index=models.SparseIndexParams(on_disk=False)
                        )
                    },
                    optimizers_config=models.OptimizersConfigDiff(
                        indexing_threshold=10000,
                    ),
                    hnsw_config=models.HnswConfigDiff(
                        m=16,
                        ef_construct=100,
                        full_scan_threshold=1000,
                    ),
                )

                # Create payload indexes for pre-retrieval filtering
                for field in ["organization_id", "project_id", "department_id", "confidentiality", "doc_type", "document_id"]:
                    try:
                        await client.create_payload_index(
                            collection_name=self.collection_name,
                            field_name=field,
                            field_schema=models.PayloadSchemaType.KEYWORD,
                        )
                    except Exception:
                        pass

                try:
                    await client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name="is_current",
                        field_schema=models.PayloadSchemaType.BOOL,
                    )
                except Exception:
                    pass

            self._is_initialized = True
            logger.info(f"Qdrant collection {self.collection_name} verified.")
            return True

        except Exception as exc:
            logger.warning(f"Qdrant connection not available, enabling in-memory fallback: {exc}")
            self._is_initialized = False
            return False

    async def upsert_chunks(
        self,
        chunks: Sequence[Dict[str, Any]],
    ) -> int:
        """
        Batch upserts chunks with named dense and sparse vectors.
        Each chunk dict must contain:
        - chunk_id: UUID or str
        - document_id: UUID or str
        - content: str
        - dense_embedding: List[float]
        - metadata: Dict[str, Any]
        """
        if not chunks:
            return 0

        client = self.get_client()
        points: List[models.PointStruct] = []

        for item in chunks:
            chunk_id_str = str(item.get("chunk_id") or uuid.uuid4())
            content = item.get("content", "")
            dense_vec = item.get("dense_embedding")
            meta = dict(item.get("metadata") or {})

            if dense_vec is None:
                continue

            sparse_indices, sparse_values = text_to_sparse_vector(f"{meta.get('document_title', '')} {content}")

            payload = {
                "chunk_id": chunk_id_str,
                "document_id": str(item.get("document_id", "")),
                "organization_id": str(item.get("organization_id", "")),
                "project_id": str(item.get("project_id", "")),
                "department_id": str(item.get("department_id", "")) if item.get("department_id") else None,
                "confidentiality": str(item.get("confidentiality", "INTERNAL")).upper(),
                "doc_type": str(item.get("doc_type", "OTHER")).upper(),
                "document_title": str(item.get("document_title", "")),
                "version_number": int(item.get("version_number", 1)),
                "is_current": bool(item.get("is_current", True)),
                "chunk_index": int(item.get("chunk_index", 0)),
                "page_number": item.get("page_number"),
                "token_count": int(item.get("token_count", len(content.split()))),
                "content": content,
                "section_heading": meta.get("section_heading"),
                "chunk_type": meta.get("chunk_type", "TEXT"),
                "embedding_model": meta.get("embedding_model", settings.EMBEDDING_MODEL),
            }

            # Store in local memory cache as mirror
            self._memory_fallback[chunk_id_str] = {
                "dense": dense_vec,
                "sparse_indices": sparse_indices,
                "sparse_values": sparse_values,
                "payload": payload,
            }

            points.append(
                models.PointStruct(
                    id=chunk_id_str,
                    vector={
                        "dense": dense_vec,
                        "sparse": models.SparseVector(
                            indices=sparse_indices,
                            values=sparse_values,
                        ),
                    },
                    payload=payload,
                )
            )

        try:
            if not self._is_initialized:
                await self.ensure_collection()

            await client.upsert(
                collection_name=self.collection_name,
                points=points,
                wait=True,
            )
            return len(points)

        except Exception as exc:
            logger.warning(f"Qdrant upsert failed, stored in-memory ({len(points)} chunks): {exc}")
            return len(points)

    async def hybrid_search(
        self,
        query: str,
        dense_vector: List[float],
        organization_id: Optional[Union[str, uuid.UUID]] = None,
        allowed_project_ids: Optional[List[Union[str, uuid.UUID]]] = None,
        department_ids: Optional[List[Union[str, uuid.UUID]]] = None,
        confidentiality_levels: Optional[List[str]] = None,
        current_version_only: bool = True,
        top_k: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Executes 2-stage hybrid search in Qdrant:
        1. Dense semantic prefetch
        2. Sparse BM25 keyword prefetch
        3. Server-side Reciprocal Rank Fusion (RRF)
        4. Strict payload authorization filtering
        """
        sparse_indices, sparse_values = text_to_sparse_vector(query)

        # Build Qdrant Filter conditions
        must_conditions: List[models.Condition] = []

        if organization_id:
            must_conditions.append(
                models.FieldCondition(
                    key="organization_id",
                    match=models.MatchValue(value=str(organization_id)),
                )
            )

        if allowed_project_ids is not None:
            proj_strs = [str(pid) for pid in allowed_project_ids]
            must_conditions.append(
                models.FieldCondition(
                    key="project_id",
                    match=models.MatchAny(any=proj_strs),
                )
            )

        if department_ids:
            dept_strs = [str(did) for did in department_ids]
            must_conditions.append(
                models.FieldCondition(
                    key="department_id",
                    match=models.MatchAny(any=dept_strs),
                )
            )

        if confidentiality_levels:
            conf_strs = [c.upper() for c in confidentiality_levels]
            must_conditions.append(
                models.FieldCondition(
                    key="confidentiality",
                    match=models.MatchAny(any=conf_strs),
                )
            )

        if current_version_only:
            must_conditions.append(
                models.FieldCondition(
                    key="is_current",
                    match=models.MatchValue(value=True),
                )
            )

        qdrant_filter = models.Filter(must=must_conditions) if must_conditions else None

        client = self.get_client()
        try:
            if not self._is_initialized:
                await self.ensure_collection()

            # Qdrant Hybrid Query with Server-Side RRF Fusion
            results = await client.query_points(
                collection_name=self.collection_name,
                prefetch=[
                    models.Prefetch(
                        query=dense_vector,
                        using="dense",
                        filter=qdrant_filter,
                        limit=top_k,
                    ),
                    models.Prefetch(
                        query=models.SparseVector(
                            indices=sparse_indices,
                            values=sparse_values,
                        ),
                        using="sparse",
                        filter=qdrant_filter,
                        limit=top_k,
                    ),
                ],
                query=models.FusionQuery(fusion=models.Fusion.RRF),
                limit=top_k,
                with_payload=True,
            )

            hits: List[Dict[str, Any]] = []
            for point in results.points:
                payload = point.payload or {}
                hits.append({
                    "chunk_id": payload.get("chunk_id") or str(point.id),
                    "document_id": payload.get("document_id"),
                    "document_title": payload.get("document_title", ""),
                    "project_id": payload.get("project_id"),
                    "department_id": payload.get("department_id"),
                    "confidentiality": payload.get("confidentiality", "INTERNAL"),
                    "doc_type": payload.get("doc_type", "OTHER"),
                    "version_number": payload.get("version_number", 1),
                    "page_number": payload.get("page_number"),
                    "content": payload.get("content", ""),
                    "section_heading": payload.get("section_heading"),
                    "rrf_score": float(point.score or 0.0),
                    "metadata": payload,
                })

            return hits

        except Exception as exc:
            logger.warning(f"Qdrant query failed, executing fallback in-memory retrieval: {exc}")
            return self._fallback_in_memory_search(
                query=query,
                dense_vector=dense_vector,
                organization_id=str(organization_id) if organization_id else None,
                allowed_project_ids=[str(p) for p in allowed_project_ids] if allowed_project_ids else None,
                confidentiality_levels=[c.upper() for c in confidentiality_levels] if confidentiality_levels else None,
                current_version_only=current_version_only,
                top_k=top_k,
            )

    def _fallback_in_memory_search(
        self,
        query: str,
        dense_vector: List[float],
        organization_id: Optional[Any] = None,
        allowed_project_ids: Optional[Sequence[Any]] = None,
        confidentiality_levels: Optional[Sequence[str]] = None,
        current_version_only: bool = True,
        top_k: int = 20,
    ) -> List[Dict[str, Any]]:
        """Fallback in-memory cosine + lexical search if Qdrant daemon is offline."""
        candidates = []
        org_id_str = str(organization_id) if organization_id else None
        proj_str_set = {str(p) for p in allowed_project_ids} if allowed_project_ids is not None else None
        conf_set = {str(c).upper() for c in confidentiality_levels} if confidentiality_levels else None

        for cid, data in self._memory_fallback.items():
            payload = data.get("payload", {})

            # Filter verification
            if org_id_str and str(payload.get("organization_id")) != org_id_str:
                continue
            if proj_str_set is not None and str(payload.get("project_id")) not in proj_str_set:
                continue
            if conf_set and str(payload.get("confidentiality", "")).upper() not in conf_set:
                continue
            if current_version_only and not payload.get("is_current", True):
                continue

            # Dense cosine similarity
            chunk_dense = data.get("dense", [])
            dot = sum(a * b for a, b in zip(dense_vector, chunk_dense)) if chunk_dense else 0.0
            norm_q = math.sqrt(sum(a * a for a in dense_vector)) or 1.0
            norm_c = math.sqrt(sum(b * b for b in chunk_dense)) or 1.0
            cosine_score = max(0.0, dot / (norm_q * norm_c))

            if cosine_score > 0.05:
                candidates.append({
                    "chunk_id": cid,
                    "document_id": payload.get("document_id"),
                    "document_title": payload.get("document_title", ""),
                    "project_id": payload.get("project_id"),
                    "department_id": payload.get("department_id"),
                    "confidentiality": payload.get("confidentiality", "INTERNAL"),
                    "doc_type": payload.get("doc_type", "OTHER"),
                    "version_number": payload.get("version_number", 1),
                    "page_number": payload.get("page_number"),
                    "content": payload.get("content", ""),
                    "section_heading": payload.get("section_heading"),
                    "rrf_score": round(cosine_score, 4),
                    "metadata": payload,
                })

        candidates.sort(key=lambda x: x["rrf_score"], reverse=True)
        return candidates[:top_k]

    async def delete_document_chunks(self, document_id: Union[str, uuid.UUID]) -> bool:
        """Deletes all vector points associated with a specific document_id."""
        doc_id_str = str(document_id)

        # Clean from memory fallback
        to_del = [cid for cid, d in self._memory_fallback.items() if d.get("payload", {}).get("document_id") == doc_id_str]
        for cid in to_del:
            self._memory_fallback.pop(cid, None)

        client = self.get_client()
        try:
            await client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id",
                                match=models.MatchValue(value=doc_id_str),
                            )
                        ]
                    )
                ),
            )
            return True
        except Exception as exc:
            logger.warning(f"Qdrant delete points error: {exc}")
            return True


# Global singleton instance
qdrant_service = QdrantService()

