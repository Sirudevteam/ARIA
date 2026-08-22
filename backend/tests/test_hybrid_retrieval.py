"""
Comprehensive Automated Test Suite for Hybrid Retrieval Engine.
Tests Pre-Retrieval Permission Filtering, Version Awareness, Document Status Filtering,
Dense Vector Search, Sparse Keyword Search, Score Normalization, and RRF Fusion.
"""

from datetime import datetime, timezone
import math
import os
from typing import AsyncGenerator, List
import uuid

from pgvector.sqlalchemy import Vector
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.base import Base
from app.models.department import Department
from app.models.document import ChunkStatus, DocStatus, DocType, Document, DocumentChunk, DocumentVersion
from app.models.organization import Organization
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.role import Role, RoleScope
from app.models.user import User, UserStatus
from app.schemas.retrieval import RetrievalFilters, UserContext
from app.services.embedding.providers.bge_m3 import BGEM3EmbeddingProvider
from app.services.embedding.service import EmbeddingService
from app.services.rag.retrieval import hybrid_retrieval_engine

# SQLite DDL type compilation compatibility handlers
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(INET, "sqlite")
def compile_inet_sqlite(type_, compiler, **kw):
    return "TEXT"

@compiles(Vector, "sqlite")
def compile_vector_sqlite(type_, compiler, **kw):
    return "TEXT"

settings = get_settings()

TEST_DB_FILE = "test_hybrid_retrieval_temp.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


class TestEntities:
    org_id: uuid.UUID
    dept1_id: uuid.UUID
    dept2_id: uuid.UUID
    admin_id: uuid.UUID
    annotator_id: uuid.UUID  # Only in Project 1
    project1_id: uuid.UUID   # Urban 3D
    project2_id: uuid.UUID   # Highway Restricted
    doc1_id: uuid.UUID
    doc2_id: uuid.UUID
    doc3_id: uuid.UUID
    doc_archived_id: uuid.UUID


entities = TestEntities()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_test_database():
    """Create test SQLite file database and seed initial fixtures once for the test module."""
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 1. Organization
        org = Organization(name="Autocruise Dynamics AI", slug="autocruise", is_active=True)
        session.add(org)
        await session.flush()
        entities.org_id = org.id

        # 2. Departments
        d1 = Department(organization_id=org.id, name="LiDAR Perception & Calibration")
        d2 = Department(organization_id=org.id, name="Sensor Fusion & Radar")
        session.add_all([d1, d2])
        await session.flush()
        entities.dept1_id = d1.id
        entities.dept2_id = d2.id

        # 3. Roles
        r_admin = Role(name="ADMIN", scope=RoleScope.organization, permissions=["*"], is_system=True)
        r_annot = Role(name="ANNOTATOR", scope=RoleScope.project, permissions=["annotation.*"], is_system=True)
        session.add_all([r_admin, r_annot])
        await session.flush()

        # 4. Users
        u_admin = User(
            organization_id=org.id,
            role_id=r_admin.id,
            email="lead@autocruise.test",
            name="Dr. Sarah Lead",
            status=UserStatus.active,
        )
        u_annot = User(
            organization_id=org.id,
            role_id=r_annot.id,
            email="alex@autocruise.test",
            name="Alex Rivera",
            status=UserStatus.active,
        )
        session.add_all([u_admin, u_annot])
        await session.flush()

        entities.admin_id = u_admin.id
        entities.annotator_id = u_annot.id

        # 5. Projects
        p1 = Project(organization_id=org.id, name="Project Alpha (Urban 3D)", status=ProjectStatus.active)
        p2 = Project(organization_id=org.id, name="Project Beta (Highway Restricted)", status=ProjectStatus.active)
        session.add_all([p1, p2])
        await session.flush()

        entities.project1_id = p1.id
        entities.project2_id = p2.id

        # 6. Project Memberships: Annotator is in Project 1 ONLY
        pm1 = ProjectMember(project_id=p1.id, user_id=u_annot.id, role_id=r_annot.id)
        session.add(pm1)

        # 7. Document 1 (Project 1, Dept 1) - Multi-version LiDAR Guide
        doc1 = Document(
            id=uuid.uuid4(),
            project_id=p1.id,
            organization_id=org.id,
            department_id=d1.id,
            title="Velodyne VLS-128 LiDAR Calibration & Annotation Guide",
            doc_type=DocType.annotation_schema,
            status=DocStatus.ready,
            confidentiality="internal",
        )
        session.add(doc1)
        entities.doc1_id = doc1.id

        # Doc 1 Version 1 (Deprecated)
        v1_old = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc1.id,
            version_number=1,
            storage_path="storage/v1_old.md",
            is_current=False,
        )
        # Doc 1 Version 2 (Current Active Version)
        v1_cur = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc1.id,
            version_number=2,
            storage_path="storage/v2_cur.md",
            is_current=True,
        )
        session.add_all([v1_old, v1_cur])

        # Chunks for Doc 1
        c_old = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc1.id,
            version_id=v1_old.id,
            chunk_index=0,
            content="Deprecated v1 coordinate system: SAE J670 standard axis definition.",
            token_count=12,
            status=ChunkStatus.embedded,
            metadata_={"page_number": 1, "section": "Old Coordinate Systems"},
        )
        c_v2_1 = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc1.id,
            version_id=v1_cur.id,
            chunk_index=0,
            content="LiDAR sensor coordinate system uses ISO 8855 standard orientation with X forward, Y left, and Z up.",
            token_count=22,
            status=ChunkStatus.embedded,
            metadata_={"page_number": 2, "section": "ISO 8855 Coordinate Standards"},
        )
        c_v2_2 = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc1.id,
            version_id=v1_cur.id,
            chunk_index=1,
            content="Bounding box annotation minimum point density requires at least 15 points per vehicle object.",
            token_count=20,
            status=ChunkStatus.embedded,
            metadata_={"page_number": 5, "section": "Point Density Requirements"},
        )
        session.add_all([c_old, c_v2_1, c_v2_2])

        # 8. Document 2 (Project 1, Dept 1) - Traffic Light Schema
        doc2 = Document(
            id=uuid.uuid4(),
            project_id=p1.id,
            organization_id=org.id,
            department_id=d1.id,
            title="Urban Traffic Light & Signal 3D Schema",
            doc_type=DocType.spec,
            status=DocStatus.ready,
            confidentiality="internal",
        )
        session.add(doc2)
        entities.doc2_id = doc2.id

        v2_cur = DocumentVersion(id=uuid.uuid4(), document_id=doc2.id, version_number=1, storage_path="storage/doc2.md", is_current=True)
        session.add(v2_cur)

        c_doc2 = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc2.id,
            version_id=v2_cur.id,
            chunk_index=0,
            content="Traffic light 3D bounding box must enclose housing and signal lights with yaw angle aligned to traffic flow.",
            token_count=24,
            status=ChunkStatus.embedded,
            metadata_={"page_number": 1, "section": "Signal Alignment"},
        )
        session.add(c_doc2)

        # 9. Document 3 (Project 2 Restricted, Dept 2) - Radar Spec
        doc3 = Document(
            id=uuid.uuid4(),
            project_id=p2.id,
            organization_id=org.id,
            department_id=d2.id,
            title="Highway Long-Range Radar and Sensor Fusion Specification",
            doc_type=DocType.spec,
            status=DocStatus.ready,
            confidentiality="restricted",
        )
        session.add(doc3)
        entities.doc3_id = doc3.id

        v3_cur = DocumentVersion(id=uuid.uuid4(), document_id=doc3.id, version_number=1, storage_path="storage/doc3.md", is_current=True)
        session.add(v3_cur)

        c_doc3 = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc3.id,
            version_id=v3_cur.id,
            chunk_index=0,
            content="Radar doppler velocity tracking at 250 meters range for highway velocity estimation.",
            token_count=18,
            status=ChunkStatus.embedded,
            metadata_={"page_number": 3, "section": "Doppler Tracking"},
        )
        session.add(c_doc3)

        # 10. Document 4 (Archived Document)
        doc_arch = Document(
            id=uuid.uuid4(),
            project_id=p1.id,
            organization_id=org.id,
            department_id=d1.id,
            title="Obsolete Camera Perception Guide 2021",
            doc_type=DocType.manual,
            status=DocStatus.archived,
            confidentiality="internal",
        )
        session.add(doc_arch)
        entities.doc_archived_id = doc_arch.id

        v_arch = DocumentVersion(id=uuid.uuid4(), document_id=doc_arch.id, version_number=1, storage_path="storage/arch.md", is_current=True)
        session.add(v_arch)

        c_arch = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc_arch.id,
            version_id=v_arch.id,
            chunk_index=0,
            content="Archived camera distortion calibration parameters.",
            token_count=10,
            status=ChunkStatus.embedded,
            metadata_={"page_number": 1},
        )
        session.add(c_arch)

        await session.flush()

        # Compute real embeddings for all chunks using BGE-M3 provider
        provider = BGEM3EmbeddingProvider(dimensions=1024)
        all_chunks = [c_old, c_v2_1, c_v2_2, c_doc2, c_doc3, c_arch]
        texts = [c.content for c in all_chunks]
        vectors = await provider.embed_texts(texts)
        for c, v in zip(all_chunks, vectors):
            c.embedding = v

        await session.commit()

    yield

    await engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Test HTTP client with overridden get_db dependency."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    await engine.dispose()


# =============================================================================
# 1. PRE-RETRIEVAL PERMISSION FILTERING TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_permission_filtering_before_retrieval():
    """
    Annotator is ONLY in Project 1. When querying for Highway Radar data (in Project 2),
    pre-retrieval RBAC filters ensure 0 chunks from Project 2 are returned.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Query annotator user
        u_annot = await session.get(User, entities.annotator_id)
        user_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_annot)
        assert len(user_ctx.accessible_project_ids) == 1
        assert entities.project1_id in user_ctx.accessible_project_ids
        assert entities.project2_id not in user_ctx.accessible_project_ids

        # Annotator queries for highway radar
        results = await hybrid_retrieval_engine.retrieve(
            db=session,
            query="Radar doppler velocity tracking",
            user_context=user_ctx,
            top_k=5,
        )
        # Cannot retrieve Project 2 chunks
        assert all(r.document_id != entities.doc3_id for r in results)

        # Admin (with full org visibility) CAN retrieve Project 2 chunks
        u_admin = await session.get(User, entities.admin_id)
        admin_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_admin)
        admin_results = await hybrid_retrieval_engine.retrieve(
            db=session,
            query="Radar doppler velocity tracking",
            user_context=admin_ctx,
            top_k=5,
        )
        assert any(r.document_id == entities.doc3_id for r in admin_results)

    await engine.dispose()


# =============================================================================
# 2. VERSION AWARENESS & STATUS FILTERING TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_version_awareness_and_status_filtering():
    """
    Verify:
    1. Deprecated v1 chunks are excluded (only current active version chunks returned).
    2. Archived documents are excluded from retrieval results.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        u_admin = await session.get(User, entities.admin_id)
        admin_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_admin)

        # 1. Version awareness: query for coordinate systems
        results = await hybrid_retrieval_engine.retrieve(
            db=session,
            query="coordinate system standard",
            user_context=admin_ctx,
            filters=RetrievalFilters(current_version_only=True),
            top_k=5,
        )
        # Must return v2 chunk (ISO 8855), NOT deprecated v1 chunk (SAE J670)
        assert len(results) > 0
        top_chunk = results[0]
        assert top_chunk.version_number == 2
        assert "ISO 8855" in top_chunk.content
        assert all("Deprecated v1" not in r.content for r in results)

        # 2. Status filtering: query for camera distortion
        arch_results = await hybrid_retrieval_engine.retrieve(
            db=session,
            query="camera distortion calibration",
            user_context=admin_ctx,
            filters=RetrievalFilters(doc_statuses=["READY"]),
            top_k=5,
        )
        # Archived document chunks must be excluded
        assert all(r.document_id != entities.doc_archived_id for r in arch_results)

    await engine.dispose()


# =============================================================================
# 3. DENSE SEMANTIC VECTOR SEARCH TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_dense_semantic_vector_search():
    """
    Conceptual semantic search: 'spatial orientation coordinate axes'
    matches 'ISO 8855 standard orientation with X forward, Y left, and Z up'
    with high similarity score and page metadata.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        u_admin = await session.get(User, entities.admin_id)
        admin_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_admin)

        results = await hybrid_retrieval_engine.retrieve(
            db=session,
            query="LiDAR sensor coordinate orientation",
            user_context=admin_ctx,
            top_k=3,
            alpha=0.9,  # Heavy dense weighting
        )
        assert len(results) > 0
        match = results[0]
        assert "ISO 8855" in match.content
        assert match.page == 2
        assert match.section == "ISO 8855 Coordinate Standards"
        assert match.similarity_score is not None
        assert match.similarity_score > 0.0

    await engine.dispose()


# =============================================================================
# 4. SPARSE KEYWORD SEARCH & EXACT ACRONYM MATCHING
# =============================================================================

@pytest.mark.asyncio
async def test_sparse_keyword_search():
    """
    Exact keyword query: '15 points'
    matches point density requirement chunk with high keyword rank.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        u_admin = await session.get(User, entities.admin_id)
        admin_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_admin)

        results = await hybrid_retrieval_engine.retrieve(
            db=session,
            query="15 points",
            user_context=admin_ctx,
            top_k=3,
            alpha=0.1,  # Heavy keyword weighting
        )
        assert len(results) > 0
        match = results[0]
        assert "15 points" in match.content
        assert match.page == 5
        assert match.keyword_score is not None

    await engine.dispose()


# =============================================================================
# 5. HYBRID RECIPROCAL RANK FUSION (RRF) & SCORE NORMALIZATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_hybrid_rrf_and_score_fusion():
    """
    Verify Hybrid RRF combines Dense and Sparse results into a unified ranked output
    with combined_score, dense_rank, keyword_rank, and match_channel.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        u_admin = await session.get(User, entities.admin_id)
        admin_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_admin)

        # Query that has both semantic concept and exact keywords
        results = await hybrid_retrieval_engine.retrieve(
            db=session,
            query="ISO 8855 LiDAR coordinate orientation",
            user_context=admin_ctx,
            top_k=5,
            alpha=0.5,
            fusion_mode="rrf",
        )
        assert len(results) > 0
        top_match = results[0]

        # Verify all return fields
        assert top_match.chunk_id is not None
        assert top_match.document_id == entities.doc1_id
        assert top_match.document_title == "Velodyne VLS-128 LiDAR Calibration & Annotation Guide"
        assert top_match.doc_type == "annotation_schema"
        assert top_match.page == 2
        assert top_match.section == "ISO 8855 Coordinate Standards"
        assert top_match.content is not None
        assert top_match.similarity_score is not None
        assert top_match.keyword_score is not None
        assert top_match.combined_score > 0.0
        assert top_match.dense_rank is not None
        assert top_match.keyword_rank is not None
        assert top_match.match_channel in ("both", "vector_only", "keyword_only")

    await engine.dispose()


# =============================================================================
# 6. API HYBRID RETRIEVAL ENDPOINTS TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_api_hybrid_retrieval_endpoints(client: AsyncClient):
    """
    Test POST /api/v1/search/retrieve and POST /api/v1/projects/{project_id}/retrieve.
    """
    token = create_access_token(user_id=entities.admin_id, email="lead@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Global hybrid retrieve endpoint
    resp1 = await client.post(
        "/api/v1/search/retrieve",
        headers=headers,
        json={
            "query": "Traffic light 3D yaw angle alignment",
            "top_k": 3,
            "alpha": 0.5,
            "fusion_mode": "rrf",
        },
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["query"] == "Traffic light 3D yaw angle alignment"
    assert data1["total_results"] >= 1
    assert any("Traffic light" in r["content"] for r in data1["results"])
    assert "combined_score" in data1["results"][0]

    # 2. Project-scoped retrieve endpoint
    resp2 = await client.post(
        f"/api/v1/search/projects/{entities.project1_id}/retrieve",
        headers=headers,
        json={
            "query": "ISO 8855 orientation",
            "top_k": 2,
        },
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["total_results"] >= 1
    assert all(r["document_id"] != str(entities.doc3_id) for r in data2["results"])
