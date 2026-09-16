"""
Hybrid Retrieval Engine for ARIA.
Combines pgvector Semantic Vector Search and Full-Text Keyword Search with
Pre-Retrieval Authorization Filtering, Version Awareness, Score Normalization,
and Reciprocal Rank Fusion (RRF).
"""

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import ChunkStatus, DocStatus, Document, DocumentChunk, DocumentVersion
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.retrieval import RetrievalFilters, RetrievedChunk, UserContext
from app.services.embedding.service import embedding_service


def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two float vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a * a for a in vec1))
    norm_b = math.sqrt(sum(b * b for b in vec2))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm_a * norm_b)))


def _compute_bm25_sparse_score(query: str, text: str, title: str = "") -> float:
    """
    Computes lexical BM25-style keyword relevance score.
    Gives higher weight to title matches, exact phrase matches, and domain acronyms.
    """
    if not query or not text:
        return 0.0

    combined_text = f"{title} {text}".lower()
    query_lower = query.lower()

    # Exact phrase bonus
    exact_bonus = 3.0 if query_lower in combined_text else 0.0

    query_tokens = set(re.findall(r"\b\w+\b", query_lower))
    if not query_tokens:
        return 0.0

    doc_tokens = re.findall(r"\b\w+\b", combined_text)
    doc_token_counts: Dict[str, int] = {}
    for t in doc_tokens:
        doc_token_counts[t] = doc_token_counts.get(t, 0) + 1

    doc_len = len(doc_tokens) or 1
    avg_len = 100.0  # reference average chunk token count
    k1 = 1.2
    b = 0.75

    score = exact_bonus
    for token in query_tokens:
        freq = doc_token_counts.get(token, 0)
        if freq > 0:
            # Acronym / technical term bonus (e.g. ISO 8855, VLS-128, LiDAR)
            term_weight = 2.0 if len(token) >= 3 and token.isalnum() else 1.0
            # BM25 term frequency saturation
            tf = (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (doc_len / avg_len)))
            score += tf * term_weight

    return round(score, 4)


class HybridRetrievalEngine:
    """
    Enterprise Hybrid Retrieval Engine with Pre-Retrieval RBAC Filtering,
    pgvector Semantic Retrieval, Full-Text Lexical Retrieval, and Result Fusion.
    """

    @staticmethod
    async def resolve_user_context(db: AsyncSession, user: User) -> UserContext:
        """
        Builds the authenticated user's security context by querying
        organization scope and explicit project memberships.
        """
        role_name = "SUPER_ADMIN"
        if user.role_id:
            from app.models.role import Role
            stmt_role = select(Role.name).where(Role.id == user.role_id)
            res_r = await db.execute(stmt_role)
            r_val = res_r.scalar_one_or_none()
            if r_val:
                role_name = r_val.upper()

        accessible_projects: List[uuid.UUID] = []
        if role_name in ("SUPER_ADMIN", "ADMIN"):
            # Admins have project visibility
            stmt = select(Project.id)
            if user.organization_id:
                stmt = stmt.where(Project.organization_id == user.organization_id)
            res = await db.execute(stmt)
            accessible_projects = list(res.scalars().all())
        else:
            # Non-admins: restricted to explicit project memberships
            stmt = (
                select(ProjectMember.project_id)
                .join(Project, Project.id == ProjectMember.project_id)
                .where(
                    ProjectMember.user_id == user.id,
                    Project.organization_id == user.organization_id,
                )
            )
            res = await db.execute(stmt)
            accessible_projects = list(res.scalars().all())

        return UserContext(
            user_id=user.id,
            user_name=user.name or (user.email.split("@")[0] if user.email else None),
            organization_id=user.organization_id,
            role_name=role_name,
            accessible_project_ids=accessible_projects,
        )

    @classmethod
    async def retrieve(
        cls,
        db: AsyncSession,
        query: str,
        user_context: UserContext,
        filters: Optional[RetrievalFilters] = None,
        top_k: int = 5,
        alpha: float = 0.5,
        fusion_mode: str = "rrf",
    ) -> List[RetrievedChunk]:
        """
        Main Retrieval Entrypoint:
        retrieve(query, user_context, filters) -> List[RetrievedChunk]
        """
        filters = filters or RetrievalFilters()
        query = query.strip()
        if not query:
            return []

        # =========================================================================
        # 1. PRE-RETRIEVAL PERMISSION & ATTRIBUTE FILTERING
        # =========================================================================
        # Zero-Trust Check: If user has no accessible projects, return immediately
        if user_context.role_name != "SUPER_ADMIN" and not user_context.accessible_project_ids:
            return []

        # Determine target project IDs based on intersection of user access and requested filter
        target_project_ids: Set[uuid.UUID]
        if user_context.role_name == "SUPER_ADMIN":
            target_project_ids = set(filters.project_ids) if filters.project_ids else set()
        else:
            allowed_set = set(user_context.accessible_project_ids)
            if filters.project_ids:
                target_project_ids = allowed_set.intersection(set(filters.project_ids))
            else:
                target_project_ids = allowed_set

            # If filtered project list is empty, return empty result
            if not target_project_ids and user_context.role_name != "SUPER_ADMIN":
                return []

        # =========================================================================
        # 1.5. QDRANT NATIVE HYBRID RETRIEVAL (Dense BGE-M3 + Sparse BM25 + RRF)
        # =========================================================================
        query_vector = await embedding_service.embed_query(query)

        try:
            from app.services.vector_db.qdrant_service import qdrant_service
            qdrant_hits = await qdrant_service.hybrid_search(
                query=query,
                dense_vector=query_vector,
                organization_id=user_context.organization_id if user_context.role_name != "SUPER_ADMIN" else None,
                allowed_project_ids=list(target_project_ids) if target_project_ids else None,
                department_ids=filters.department_ids if filters.department_ids else None,
                current_version_only=filters.current_version_only,
                top_k=top_k,
            )

            if qdrant_hits:
                qdrant_results: List[RetrievedChunk] = []
                for idx, hit in enumerate(qdrant_hits):
                    c_id_str = hit.get("chunk_id")
                    d_id_str = hit.get("document_id")
                    meta = hit.get("metadata", {})
                    qdrant_results.append(
                        RetrievedChunk(
                            chunk_id=uuid.UUID(c_id_str) if c_id_str else uuid.uuid4(),
                            document_id=uuid.UUID(d_id_str) if d_id_str else uuid.uuid4(),
                            document_title=hit.get("document_title") or "Document",
                            doc_type=hit.get("doc_type", "OTHER"),
                            version_number=int(hit.get("version_number", 1)),
                            page=int(hit["page_number"]) if hit.get("page_number") is not None else None,
                            section=hit.get("section_heading"),
                            content=hit.get("content", ""),
                            similarity_score=round(hit.get("rrf_score", 0.0), 4),
                            keyword_score=round(hit.get("rrf_score", 0.0), 4),
                            combined_score=round(hit.get("rrf_score", 0.0), 4),
                            dense_rank=idx + 1,
                            keyword_rank=idx + 1,
                            match_channel="both",
                            metadata=meta,
                        )
                    )
                return qdrant_results
        except Exception:
            pass

        # Build candidate chunks query with all security & status filters (PostgreSQL fallback)
        stmt = (
            select(DocumentChunk)
            .join(Document, Document.id == DocumentChunk.document_id)
            .outerjoin(DocumentVersion, DocumentVersion.id == DocumentChunk.document_version_id)
            .options(
                selectinload(DocumentChunk.document).selectinload(Document.project),
                selectinload(DocumentChunk.version),
            )
        )

        # Organization boundary filter
        if user_context.role_name != "SUPER_ADMIN":
            stmt = stmt.where(Document.organization_id == user_context.organization_id)

        # Project boundary filter
        if target_project_ids:
            stmt = stmt.where(Document.project_id.in_(list(target_project_ids)))

        # Department filter
        if filters.department_ids:
            stmt = stmt.where(Document.department_id.in_(filters.department_ids))

        # DocType filter
        if filters.doc_types:
            doc_type_enums = []
            for dt in filters.doc_types:
                try:
                    doc_type_enums.append(DocType(str(dt).lower()))
                except ValueError:
                    try:
                        doc_type_enums.append(DocType(dt))
                    except ValueError:
                        pass
            if doc_type_enums:
                stmt = stmt.where(Document.doc_type.in_(doc_type_enums))

        # Document Status filter (default: READY only)
        if filters.doc_statuses:
            status_enums = []
            for s in filters.doc_statuses:
                try:
                    status_enums.append(DocStatus(str(s).lower()))
                except ValueError:
                    try:
                        status_enums.append(DocStatus(s))
                    except ValueError:
                        pass
            if status_enums:
                stmt = stmt.where(Document.status.in_(status_enums))

        # Version awareness filter (only current active version chunks)
        if filters.current_version_only:
            stmt = stmt.where(
                or_(
                    DocumentVersion.is_current == True,
                    DocumentChunk.document_version_id == None,
                )
            )

        # Execute candidate chunks lookup
        res = await db.execute(stmt)
        candidate_chunks = res.scalars().all()

        if not candidate_chunks:
            return []

        # =========================================================================
        # 2. DENSE SEMANTIC VECTOR RETRIEVAL (pgvector)
        # =========================================================================
        query_vector = await embedding_service.embed_query(query)

        dense_scored: List[Tuple[DocumentChunk, float]] = []
        for chunk in candidate_chunks:
            emb = chunk.embedding
            if isinstance(emb, str):
                import json
                try:
                    emb = json.loads(emb)
                except Exception:
                    try:
                        import ast
                        emb = ast.literal_eval(emb)
                    except Exception:
                        emb = None

            if emb is not None and isinstance(emb, (list, tuple)) and len(emb) > 0:
                sim = _cosine_similarity(query_vector, list(emb))
                if sim >= filters.min_similarity_threshold:
                    dense_scored.append((chunk, sim))

        # Sort dense by similarity descending
        dense_scored.sort(key=lambda x: x[1], reverse=True)

        # =========================================================================
        # 3. SPARSE LEXICAL KEYWORD RETRIEVAL (BM25 / Full-Text)
        # =========================================================================
        sparse_scored: List[Tuple[DocumentChunk, float]] = []
        for chunk in candidate_chunks:
            doc_title = chunk.document.title if chunk.document else ""
            bm25_score = _compute_bm25_sparse_score(query, chunk.content, doc_title)
            if bm25_score > 0.0:
                sparse_scored.append((chunk, bm25_score))

        # Sort sparse by lexical score descending
        sparse_scored.sort(key=lambda x: x[1], reverse=True)

        # =========================================================================
        # 4. SCORE NORMALIZATION & RESULT FUSION (RRF / Weighted)
        # =========================================================================
        # Assign ranks
        dense_rank_map: Dict[uuid.UUID, int] = {c.id: idx + 1 for idx, (c, _) in enumerate(dense_scored)}
        dense_score_map: Dict[uuid.UUID, float] = {c.id: s for c, s in dense_scored}

        sparse_rank_map: Dict[uuid.UUID, int] = {c.id: idx + 1 for idx, (c, _) in enumerate(sparse_scored)}
        sparse_score_map: Dict[uuid.UUID, float] = {c.id: s for c, s in sparse_scored}

        # Normalize sparse scores to [0, 1] using min-max scaling for score display
        max_sparse = max(sparse_score_map.values()) if sparse_score_map else 1.0
        min_sparse = min(sparse_score_map.values()) if sparse_score_map else 0.0
        sparse_denom = (max_sparse - min_sparse) or 1.0

        all_matched_chunk_ids = set(dense_rank_map.keys()).union(set(sparse_rank_map.keys()))
        chunk_lookup: Dict[uuid.UUID, DocumentChunk] = {c.id: c for c in candidate_chunks}

        fused_items: List[RetrievedChunk] = []
        RRF_K = 60  # Standard Reciprocal Rank Fusion smoothing constant

        for chunk_id in all_matched_chunk_ids:
            chunk = chunk_lookup[chunk_id]
            doc = chunk.document
            version = chunk.version

            dense_rank = dense_rank_map.get(chunk_id)
            dense_score = dense_score_map.get(chunk_id)

            sparse_rank = sparse_rank_map.get(chunk_id)
            raw_sparse_score = sparse_score_map.get(chunk_id)
            norm_sparse_score = (
                ((raw_sparse_score - min_sparse) / sparse_denom)
                if raw_sparse_score is not None
                else None
            )

            # Determine match channel
            if dense_rank and sparse_rank:
                channel = "both"
            elif dense_rank:
                channel = "vector_only"
            else:
                channel = "keyword_only"

            # Compute combined score
            if fusion_mode == "weighted":
                # Weighted score blending: alpha * S_dense + (1-alpha) * S_sparse
                d_val = dense_score if dense_score is not None else 0.0
                s_val = norm_sparse_score if norm_sparse_score is not None else 0.0
                combined_score = round(alpha * d_val + (1.0 - alpha) * s_val, 4)
            else:
                # Reciprocal Rank Fusion (RRF): (alpha / (k + rank_d)) + ((1-alpha) / (k + rank_s))
                rrf_dense = (alpha / (RRF_K + dense_rank)) if dense_rank else 0.0
                rrf_sparse = ((1.0 - alpha) / (RRF_K + sparse_rank)) if sparse_rank else 0.0
                # Scale up RRF for human-readable score [0, 1]
                combined_score = round((rrf_dense + rrf_sparse) * (RRF_K + 1), 4)

            meta = dict(chunk.metadata_ or {})
            page_num = meta.get("page_number") or meta.get("page")
            section_name = meta.get("section") or meta.get("heading")

            fused_items.append(
                RetrievedChunk(
                    chunk_id=chunk.id,
                    document_id=chunk.document_id,
                    document_title=doc.title if doc else "Document",
                    doc_type=doc.doc_type.value if doc and hasattr(doc.doc_type, "value") else str(doc.doc_type if doc else "other"),
                    version_number=version.version_number if version else 1,
                    page=int(page_num) if page_num is not None else None,
                    section=str(section_name) if section_name else None,
                    content=chunk.content,
                    similarity_score=round(dense_score, 4) if dense_score is not None else None,
                    keyword_score=round(norm_sparse_score, 4) if norm_sparse_score is not None else None,
                    combined_score=combined_score,
                    dense_rank=dense_rank,
                    keyword_rank=sparse_rank,
                    match_channel=channel,
                    metadata=meta,
                )
            )

        # Sort by combined score descending
        fused_items.sort(key=lambda x: x.combined_score, reverse=True)

        return fused_items[:top_k]

    @classmethod
    async def retrieve_and_rerank(
        cls,
        db: AsyncSession,
        query: str,
        user_context: UserContext,
        filters: Optional[RetrievalFilters] = None,
        candidate_k: int = 20,
        final_top_k: int = 5,
        alpha: float = 0.5,
        fusion_mode: str = "rrf",
        min_relevance_threshold: float = 0.25,
        enable_rerank: bool = True,
    ):
        """
        2-Stage Retrieval Pipeline:
        1. Hybrid Retrieval retrieves candidate_k candidates (e.g. 20 chunks).
        2. Semantic Cross-Encoder Reranker scores & filters candidates by min_relevance_threshold,
           dropping irrelevant chunks and returning top-K high precision context.
        """
        from app.schemas.reranker import RerankedChunk
        from app.services.rag.reranker.service import reranker_service

        # Stage 1: High Recall Candidates Retrieval
        initial_k = candidate_k if enable_rerank else final_top_k
        candidates = await cls.retrieve(
            db=db,
            query=query,
            user_context=user_context,
            filters=filters,
            top_k=initial_k,
            alpha=alpha,
            fusion_mode=fusion_mode,
        )

        if not enable_rerank or not candidates:
            return [
                RerankedChunk(
                    chunk_id=c.chunk_id,
                    document_id=c.document_id,
                    document_title=c.document_title,
                    doc_type=c.doc_type,
                    version_number=c.version_number,
                    page=c.page,
                    section=c.section,
                    content=c.content,
                    similarity_score=c.similarity_score,
                    keyword_score=c.keyword_score,
                    combined_score=c.combined_score,
                    rerank_score=c.combined_score,
                    rerank_rank=idx + 1,
                    original_rank=idx + 1,
                    rank_delta=0,
                    match_channel=c.match_channel,
                    reranker_model="passthrough",
                    metadata=c.metadata,
                )
                for idx, c in enumerate(candidates[:final_top_k])
            ]

        # Stage 2: Deep Cross-Encoder Reranking and Irrelevance Threshold Pruning
        return await reranker_service.rerank_candidates(
            query=query,
            chunks=candidates,
            top_k=final_top_k,
            min_threshold=min_relevance_threshold,
        )


hybrid_retrieval_engine = HybridRetrievalEngine()
