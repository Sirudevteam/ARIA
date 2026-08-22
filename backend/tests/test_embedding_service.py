"""
Comprehensive Automated Test Suite for Configurable Embedding Service.
Tests Interface Abstraction, Provider Swapping, Batching, Exponential Retry,
Content-Hash Deduplication, Model Version Tracking, and Database Persistence.
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
from app.models.document import ChunkStatus, DocStatus, DocType, Document, DocumentChunk, DocumentVersion
from app.models.organization import Organization
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.role import Role, RoleScope
from app.models.user import User, UserStatus
from app.services.embedding.base import BaseEmbeddingProvider
from app.services.embedding.factory import (
    get_embedding_provider,
    register_embedding_provider,
)
from app.services.embedding.providers.bge_m3 import BGEM3EmbeddingProvider
from app.services.embedding.providers.mock import MockEmbeddingProvider
from app.services.embedding.providers.openai import OpenAIEmbeddingProvider
from app.services.embedding.retry import with_retry
from app.services.embedding.service import EmbeddingService

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

TEST_DB_FILE = "test_embedding_temp.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


class TestEntities:
    org_id: uuid.UUID
    admin_id: uuid.UUID
    project_id: uuid.UUID
    doc_id: uuid.UUID
    chunk1_id: uuid.UUID
    chunk2_id: uuid.UUID


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
        org = Organization(name="Perception Dynamics", slug="perception-dynamics", is_active=True)
        session.add(org)
        await session.flush()
        entities.org_id = org.id

        # 2. Roles & Admin User
        r_admin = Role(name="ADMIN", scope=RoleScope.organization, permissions=["*"], is_system=True)
        session.add(r_admin)
        await session.flush()

        u_admin = User(
            organization_id=org.id,
            role_id=r_admin.id,
            email="admin@perception.test",
            name="Sarah Perception Lead",
            status=UserStatus.active,
        )
        session.add(u_admin)
        await session.flush()
        entities.admin_id = u_admin.id

        # 3. Project
        proj = Project(
            organization_id=org.id,
            name="Autonomous LiDAR Pipeline",
            status=ProjectStatus.active,
        )
        session.add(proj)
        await session.flush()
        entities.project_id = proj.id

        # 4. Document + Chunks
        doc = Document(
            id=uuid.uuid4(),
            project_id=proj.id,
            organization_id=org.id,
            uploaded_by=u_admin.id,
            title="3D LiDAR Calibration & Annotation Guide",
            doc_type=DocType.annotation_schema,
            status=DocStatus.uploaded,
            confidentiality="internal",
            language="en",
        )
        session.add(doc)
        await session.flush()
        entities.doc_id = doc.id

        # Initial Document Version
        v1 = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_number=1,
            storage_path="storage/test/v1_guide.md",
            is_current=True,
        )
        session.add(v1)

        # 2 Unembedded Chunks
        c1 = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_id=v1.id,
            chunk_index=0,
            content="LiDAR sensor coordinate system uses ISO 8855 standard orientation with X forward and Z up.",
            token_count=18,
            status=ChunkStatus.pending,
        )
        c2 = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_id=v1.id,
            chunk_index=1,
            content="Bounding box annotation minimum point density requires at least 15 points per vehicle object.",
            token_count=20,
            status=ChunkStatus.pending,
        )
        session.add_all([c1, c2])
        await session.commit()

        entities.chunk1_id = c1.id
        entities.chunk2_id = c2.id

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
# 1. INTERFACE ABSTRACTION & FACTORY TESTS
# =============================================================================

def test_embedding_factory_resolution():
    """Verify factory returns appropriate provider instances without hardcoding."""
    # BGE-M3
    bge = get_embedding_provider("bge_m3")
    assert isinstance(bge, BGEM3EmbeddingProvider)
    assert bge.provider_name == "bge_m3"
    assert bge.dimensions == 1024
    assert "bge_m3:" in bge.get_model_identifier()

    # OpenAI
    openai_prov = get_embedding_provider("openai")
    assert isinstance(openai_prov, OpenAIEmbeddingProvider)
    assert openai_prov.provider_name == "openai"
    assert openai_prov.dimensions == 1536
    assert "openai:" in openai_prov.get_model_identifier()

    # Mock
    mock_prov = get_embedding_provider("mock")
    assert isinstance(mock_prov, MockEmbeddingProvider)
    assert mock_prov.provider_name == "mock"


def test_custom_provider_registration():
    """Verify runtime registration of custom embedding providers."""
    class CustomProvider(BaseEmbeddingProvider):
        @property
        def provider_name(self) -> str:
            return "custom_gemini"

        @property
        def model_name(self) -> str:
            return "text-embedding-004"

        @property
        def dimensions(self) -> int:
            return 768

        async def embed_texts(self, texts: List[str]) -> List[List[float]]:
            return [[0.1] * 768 for _ in texts]

        async def embed_query(self, query: str) -> List[float]:
            return [0.1] * 768

    register_embedding_provider("custom_gemini", CustomProvider)
    resolved = get_embedding_provider("custom_gemini")
    assert isinstance(resolved, CustomProvider)
    assert resolved.dimensions == 768


# =============================================================================
# 2. BATCH EMBEDDING & VECTOR NORMALIZATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_batch_embedding_and_normalization():
    """Verify batch processing produces unit-normalized vectors (norm = 1.0)."""
    provider = BGEM3EmbeddingProvider(dimensions=1024)

    test_corpus = [
        "LiDAR point cloud semantic segmentation.",
        "Camera radar sensor fusion bounding boxes.",
        "Dynamic object tracking with Kalman filters.",
    ]

    vectors = await provider.embed_texts(test_corpus)
    assert len(vectors) == 3
    for vec in vectors:
        assert len(vec) == 1024
        # Verify L2 unit norm: ||v|| ≈ 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        assert abs(norm - 1.0) < 1e-3


# =============================================================================
# 3. RETRY HANDLER TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_retry_handler_success_after_transient_failure():
    """Verify retry handler recovers from transient connection drops."""
    attempt_count = 0

    async def flaky_api_call(payload: str):
        nonlocal attempt_count
        attempt_count += 1
        if attempt_count < 3:
            raise ConnectionResetError("Temporary network reset")
        return f"success: {payload}"

    result = await with_retry(
        flaky_api_call,
        "sample data",
        max_retries=4,
        initial_backoff=0.05,
        retryable_exceptions=(ConnectionResetError,),
    )
    assert result == "success: sample data"
    assert attempt_count == 3


@pytest.mark.asyncio
async def test_retry_handler_raises_when_retries_exhausted():
    """Verify retry handler re-raises exception when max retries exceeded."""
    async def always_failing_call():
        raise TimeoutError("Endpoint timeout")

    with pytest.raises(TimeoutError):
        await with_retry(
            always_failing_call,
            max_retries=2,
            initial_backoff=0.05,
            retryable_exceptions=(TimeoutError,),
        )


# =============================================================================
# 4. DOMAIN EMBEDDING SERVICE & DEDUPLICATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_embed_document_chunks_and_deduplication():
    """Test chunk embedding in database, model tracking, and duplicate prevention."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Query existing chunks
        stmt = select(DocumentChunk).where(DocumentChunk.document_id == entities.doc_id)
        res = await session.execute(stmt)
        chunks = res.scalars().all()
        assert len(chunks) == 2

        service = EmbeddingService(provider=BGEM3EmbeddingProvider(dimensions=1024))

        # 1. First run: Should embed both chunks
        result1 = await service.embed_document_chunks(
            db=session,
            document_id=entities.doc_id,
            chunks=list(chunks),
            force=False,
        )
        assert result1["total_chunks"] == 2
        assert result1["embedded_count"] == 2
        assert result1["skipped_count"] == 0

        # Verify DB records updated
        res_check = await session.execute(stmt)
        updated_chunks = res_check.scalars().all()
        for c in updated_chunks:
            assert c.status == ChunkStatus.embedded
            assert c.embedding is not None
            assert len(c.embedding) == 1024
            assert "content_hash" in c.metadata_
            assert c.metadata_["embedding_model"] == "bge_m3:BAAI/bge-m3:1024"

        # 2. Second run: Duplicate prevention should skip both chunks
        result2 = await service.embed_document_chunks(
            db=session,
            document_id=entities.doc_id,
            chunks=list(updated_chunks),
            force=False,
        )
        assert result2["total_chunks"] == 2
        assert result2["embedded_count"] == 0
        assert result2["skipped_count"] == 2

        # 3. Force re-embedding should re-embed both chunks
        result3 = await service.embed_document_chunks(
            db=session,
            document_id=entities.doc_id,
            chunks=list(updated_chunks),
            force=True,
        )
        assert result3["embedded_count"] == 2
        assert result3["skipped_count"] == 0

    await engine.dispose()


# =============================================================================
# 5. RE-EMBEDDING ON MODEL CHANGE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_reembedding_when_provider_model_changes():
    """Verify switching embedding provider triggers re-embedding of stale chunks."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        stmt = select(DocumentChunk).where(DocumentChunk.document_id == entities.doc_id)
        res = await session.execute(stmt)
        chunks = res.scalars().all()

        # Switch to OpenAI provider (1536-dim)
        openai_service = EmbeddingService(provider=OpenAIEmbeddingProvider(dimensions=1536))

        result = await openai_service.embed_document_chunks(
            db=session,
            document_id=entities.doc_id,
            chunks=list(chunks),
            force=False,  # Should detect model change automatically
        )
        assert result["embedded_count"] == 2
        assert result["embedding_model"] == "openai:text-embedding-3-small:1536"
        assert result["dimensions"] == 1536

        # Check DB records
        res_check = await session.execute(stmt)
        for c in res_check.scalars().all():
            assert c.metadata_["embedding_model"] == "openai:text-embedding-3-small:1536"
            assert len(c.embedding) == 1536

    await engine.dispose()


# =============================================================================
# 6. EMBEDDING API ENDPOINTS TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_api_embedding_info_and_query(client: AsyncClient):
    """Test GET /api/v1/embedding/info and POST /api/v1/embedding/query."""
    token = create_access_token(user_id=entities.admin_id, email="admin@perception.test")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Info endpoint
    resp_info = await client.get("/api/v1/embedding/info")
    assert resp_info.status_code == 200
    info_data = resp_info.json()
    assert "provider" in info_data
    assert "model_name" in info_data
    assert "dimensions" in info_data

    # 2. Query embedding endpoint
    resp_q = await client.post(
        "/api/v1/embedding/query",
        headers=headers,
        json={"query": "LiDAR cuboid bounding box rules"},
    )
    assert resp_q.status_code == 200
    q_data = resp_q.json()
    assert len(q_data["embedding"]) == info_data["dimensions"]
    assert q_data["query"] == "LiDAR cuboid bounding box rules"

    # 3. Document Re-embed endpoint
    resp_reembed = await client.post(
        f"/api/v1/embedding/documents/{entities.doc_id}/reembed?force=true",
        headers=headers,
    )
    assert resp_reembed.status_code == 200
    reembed_data = resp_reembed.json()
    assert reembed_data["success"] is True
    assert reembed_data["embedded_count"] == 2
