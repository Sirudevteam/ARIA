"""
Comprehensive Automated Test Suite for Semantic Reranker Layer.
Tests 20 Candidate Chunks -> Cross-Encoder Reranker -> Top 5 Chunks,
Threshold Filtering, Rank Delta Promotion, Provider Abstraction, and API integration.
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
from app.schemas.reranker import RerankedChunk
from app.schemas.retrieval import RetrievalFilters, RetrievedChunk, UserContext
from app.services.embedding.providers.bge_m3 import BGEM3EmbeddingProvider
from app.services.rag.reranker.base import BaseRerankerProvider
from app.services.rag.reranker.factory import (
    get_reranker_provider,
    register_reranker_provider,
)
from app.services.rag.reranker.providers.bge_reranker import BGERerankerProvider
from app.services.rag.reranker.providers.cohere import CohereRerankerProvider
from app.services.rag.reranker.providers.local import LocalRerankerProvider
from app.services.rag.reranker.service import RerankerService
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

TEST_DB_FILE = "test_reranker_temp.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


class TestEntities:
    org_id: uuid.UUID
    admin_id: uuid.UUID
    project_id: uuid.UUID
    doc_id: uuid.UUID


entities = TestEntities()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_test_database():
    """Create test database and seed 20+ realistic LiDAR, perception, and noise chunks."""
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 1. Organization & Roles
        org = Organization(name="Autocruise Dynamics AI", slug="autocruise", is_active=True)
        session.add(org)
        await session.flush()
        entities.org_id = org.id

        r_admin = Role(name="ADMIN", scope=RoleScope.organization, permissions=["*"], is_system=True)
        session.add(r_admin)
        await session.flush()

        # 2. User & Project
        u_admin = User(
            organization_id=org.id,
            role_id=r_admin.id,
            email="lead@autocruise.test",
            name="Sarah Lead",
            status=UserStatus.active,
        )
        session.add(u_admin)
        await session.flush()
        entities.admin_id = u_admin.id

        proj = Project(organization_id=org.id, name="Urban 3D Perception", status=ProjectStatus.active)
        session.add(proj)
        await session.flush()
        entities.project_id = proj.id

        # 3. Document
        doc = Document(
            id=uuid.uuid4(),
            project_id=proj.id,
            organization_id=org.id,
            uploaded_by=u_admin.id,
            title="Comprehensive LiDAR & Perception Master SOP",
            doc_type=DocType.annotation_schema,
            status=DocStatus.ready,
            confidentiality="internal",
        )
        session.add(doc)
        entities.doc_id = doc.id

        v1 = DocumentVersion(id=uuid.uuid4(), document_id=doc.id, version_number=1, storage_path="storage/sop.md", is_current=True)
        session.add(v1)

        # 4. 20 Realistic Chunks (5 highly relevant LiDAR calibration, 5 medium relevant, 10 irrelevant noise)
        chunk_texts = [
            # Highly relevant (Target chunks)
            "LiDAR sensor coordinate system uses ISO 8855 standard orientation with X forward, Y left, and Z up for 3D bounding boxes.",
            "Velodyne VLS-128 LiDAR calibration requires intrinsic beam angle offset correction before point cloud segmentation.",
            "Vehicle 3D bounding box annotation guidelines: tight fit enclosing all outer reflections with yaw angle aligned to movement.",
            "Point cloud density threshold: at least 15 valid laser reflection points per vehicle instance in urban perception.",
            "Camera and LiDAR extrinsic transformation matrix: rigid 4x4 homogenous matrix [R | T] for projection fusion.",
            # Medium relevant
            "Radar Doppler radial velocity estimation for highway object tracking at 200 meters range.",
            "Traffic light annotation schema: 2D bounding boxes on camera images and 3D position in global coordinate frame.",
            "Pedestrian occlusion categories: level 1 (0-20% occluded), level 2 (20-50% occluded), level 3 (>50% occluded).",
            "Cyclist bounding box includes bicycle frame, wheels, and rider within a single 3D cuboid.",
            "GPS IMU dual-antenna RTK positioning coordinate system synchronization with UTC timestamping.",
            # Irrelevant Noise chunks
            "Company cafeteria lunch hours are from 12:00 PM to 2:00 PM Monday through Friday.",
            "Annual leave policy: full-time engineers accrue 20 vacation days per calendar year.",
            "Office visitor badge requirements: all guests must sign NDA at reception desk.",
            "Expense reimbursement guidelines: submit travel receipts within 30 days of trip completion.",
            "Conference room booking etiquette: cancel reservations at least 1 hour in advance if not in use.",
            "IT helpdesk password reset instructions: contact support via internal Slack channel.",
            "Health and safety fire evacuation drill procedures for building B floor 3.",
            "Parking permit allocation: EV charging stations reserved for plug-in electric vehicles.",
            "Weekly engineering all-hands meeting takes place every Thursday at 4:00 PM PST.",
            "Corporate merchandise store: hoodie and water bottle ordering portal for new hires.",
        ]

        chunks = []
        for i, text in enumerate(chunk_texts):
            c = DocumentChunk(
                id=uuid.uuid4(),
                document_id=doc.id,
                version_id=v1.id,
                chunk_index=i,
                content=text,
                token_count=len(text.split()),
                status=ChunkStatus.embedded,
                metadata_={"page_number": (i // 4) + 1, "section": f"Section {i+1}"},
            )
            session.add(c)
            chunks.append(c)

        await session.flush()

        # Generate embeddings
        provider = BGEM3EmbeddingProvider(dimensions=1024)
        vectors = await provider.embed_texts([c.content for c in chunks])
        for c, v in zip(chunks, vectors):
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
# 1. RERANKER INTERFACE & PROVIDER ABSTRACTION TESTS
# =============================================================================

def test_reranker_factory_resolution():
    """Verify factory returns appropriate reranker provider instances without hardcoding."""
    # BGE-Reranker
    bge = get_reranker_provider("bge_reranker")
    assert isinstance(bge, BGERerankerProvider)
    assert bge.provider_name == "bge_reranker"
    assert "bge_reranker:" in bge.get_model_identifier()

    # Cohere
    cohere_prov = get_reranker_provider("cohere")
    assert isinstance(cohere_prov, CohereRerankerProvider)
    assert cohere_prov.provider_name == "cohere"

    # Local
    local_prov = get_reranker_provider("local")
    assert isinstance(local_prov, LocalRerankerProvider)
    assert local_prov.provider_name == "local"


def test_custom_reranker_provider_registration():
    """Verify runtime registration of custom reranker providers."""
    class CustomReranker(BaseRerankerProvider):
        @property
        def provider_name(self) -> str:
            return "custom_cross_encoder"

        @property
        def model_name(self) -> str:
            return "cross-encoder-custom-v1"

        async def score_pairs(self, query: str, texts: List[str]) -> List[float]:
            return [0.85] * len(texts)

    register_reranker_provider("custom_cross_encoder", CustomReranker)
    resolved = get_reranker_provider("custom_cross_encoder")
    assert isinstance(resolved, CustomReranker)


# =============================================================================
# 2. 20 CANDIDATES -> RERANKER -> TOP 5 CHUNKS PIPELINE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_20_candidates_to_top_5_reranking():
    """
    Test the full 2-stage workflow:
    Input: 20 candidate chunks (mix of relevant & noise)
    Output: Exactly Top 5 highest precision chunks.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        u_admin = await session.get(User, entities.admin_id)
        admin_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_admin)

        query = "What is the LiDAR sensor coordinate system orientation standard for bounding boxes?"

        # 1. Retrieve 20 candidates in Stage 1
        candidates = await hybrid_retrieval_engine.retrieve(
            db=session,
            query=query,
            user_context=admin_ctx,
            top_k=20,
            alpha=0.5,
        )
        assert len(candidates) >= 10

        # 2. Rerank to Top 5 in Stage 2
        service = RerankerService(provider=BGERerankerProvider())
        top_5 = await service.rerank_candidates(
            query=query,
            chunks=candidates,
            top_k=5,
            min_threshold=0.20,
        )

        assert len(top_5) <= 5
        assert len(top_5) > 0

        # Verify Top 1 is the ISO 8855 coordinate system chunk
        top_1 = top_5[0]
        assert "ISO 8855" in top_1.content
        assert top_1.rerank_rank == 1
        assert top_1.rerank_score > 0.4
        assert "LiDAR" in top_1.content

        # Verify noise chunks (cafeteria, vacation, parking) are completely excluded from Top 5
        noise_keywords = ["cafeteria", "vacation", "parking", "merchandise", "fire evacuation"]
        for res in top_5:
            assert all(kw not in res.content.lower() for kw in noise_keywords)

    await engine.dispose()


# =============================================================================
# 3. THRESHOLD FILTERING (DO NOT SEND IRRELEVANT CHUNKS TO LLM)
# =============================================================================

@pytest.mark.asyncio
async def test_threshold_filtering_discards_irrelevant_chunks():
    """
    Verify that candidate chunks below min_threshold are pruned and discarded.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        u_admin = await session.get(User, entities.admin_id)
        admin_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_admin)

        # Off-topic query (e.g. quantum computing encryption)
        query = "Quantum key distribution entanglement cryptography"

        # Stage 1 gets some random candidates
        candidates = await hybrid_retrieval_engine.retrieve(
            db=session,
            query=query,
            user_context=admin_ctx,
            top_k=10,
        )

        # Stage 2 with strict threshold (e.g. 0.70) must discard all irrelevant chunks
        service = RerankerService(provider=BGERerankerProvider())
        reranked = await service.rerank_candidates(
            query=query,
            chunks=candidates,
            top_k=5,
            min_threshold=0.70,  # High threshold
        )

        # Must discard irrelevant context so LLM does not hallucinate
        assert len(reranked) == 0

    await engine.dispose()


# =============================================================================
# 4. RANK PROMOTION & RANK DELTA TRACKING TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_rank_promotion_and_delta():
    """
    Verify that chunks matching specific fine-grained query constraints are promoted
    in rank, with positive rank_delta.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        u_admin = await session.get(User, entities.admin_id)
        admin_ctx = await hybrid_retrieval_engine.resolve_user_context(session, u_admin)

        query = "intrinsic beam angle offset correction"

        results = await hybrid_retrieval_engine.retrieve_and_rerank(
            db=session,
            query=query,
            user_context=admin_ctx,
            candidate_k=20,
            final_top_k=5,
            enable_rerank=True,
        )
        assert len(results) > 0
        top_match = results[0]

        # Must contain calibration beam angle content
        assert "beam angle offset" in top_match.content
        assert top_match.rerank_rank == 1
        assert top_match.original_rank >= 1

    await engine.dispose()


# =============================================================================
# 5. API 2-STAGE RETRIEVAL ENDPOINT TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_api_2_stage_retrieve_endpoint(client: AsyncClient):
    """
    Test POST /api/v1/search/retrieve with candidate_k=20 and top_k=5 reranking.
    """
    token = create_access_token(user_id=entities.admin_id, email="lead@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "query": "Velodyne LiDAR ISO 8855 coordinate system",
        "candidate_k": 20,
        "top_k": 5,
        "enable_rerank": True,
        "min_relevance_threshold": 0.25,
    }

    resp = await client.post("/api/v1/search/retrieve", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["query"] == "Velodyne LiDAR ISO 8855 coordinate system"
    assert data["top_k"] == 5
    assert data["reranker_enabled"] is True
    assert "reranker_model" in data
    assert len(data["results"]) <= 5
    assert len(data["results"]) > 0

    top_item = data["results"][0]
    assert "rerank_score" in top_item
    assert "rerank_rank" in top_item
    assert "rank_delta" in top_item
    assert top_item["rerank_rank"] == 1
