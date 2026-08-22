"""
Comprehensive Automated Test Suite for Closed-Loop Knowledge Flywheel.
Tests feedback capture (👍 / 👎), root-cause gap categorization,
and admin knowledge gap resolution with BGE-M3 vector indexing.
"""

from datetime import datetime, timezone
import os
from typing import AsyncGenerator
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
from app.models.organization import Organization
from app.models.project import Project, ProjectStatus
from app.models.role import Role, RoleScope
from app.models.user import User, UserStatus

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

TEST_DB_FILE = f"test_flywheel_{uuid.uuid4().hex[:8]}.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


class TestEntities:
    org_id: uuid.UUID
    admin_id: uuid.UUID
    annotator_id: uuid.UUID
    project_id: uuid.UUID


entities = TestEntities()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_test_database():
    """Create test SQLite database and seed initial fixtures."""
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 1. Organization
        org = Organization(
            name="Autocruise Dynamics AI",
            slug="autocruise-flywheel",
            is_active=True,
        )
        session.add(org)
        await session.flush()
        entities.org_id = org.id

        # 2. Roles
        r_admin = Role(name="ADMIN", scope=RoleScope.organization, permissions=["org.*", "user.*", "admin.*"], is_system=True)
        r_annot = Role(name="ANNOTATOR", scope=RoleScope.project, permissions=["annotation.*"], is_system=True)
        session.add_all([r_admin, r_annot])
        await session.flush()

        # 3. Users
        u_admin = User(
            organization_id=org.id,
            role_id=r_admin.id,
            email="sarah.admin@autocruise.test",
            name="Dr. Sarah Chen (Admin)",
            status=UserStatus.active,
        )
        u_annot = User(
            organization_id=org.id,
            role_id=r_annot.id,
            email="alex.annotator@autocruise.test",
            name="Alex Chen (Annotator)",
            status=UserStatus.active,
        )
        session.add_all([u_admin, u_annot])
        await session.flush()

        entities.admin_id = u_admin.id
        entities.annotator_id = u_annot.id

        # 4. Project
        p = Project(
            organization_id=org.id,
            name="Urban 3D Perception Project",
            status=ProjectStatus.active,
        )
        session.add(p)
        await session.flush()
        entities.project_id = p.id

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
# 1. FEEDBACK CAPTURE (👍 / 👎) TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_submit_positive_feedback(client: AsyncClient):
    """Employee submits positive feedback for accurate RAG answer."""
    token = create_access_token(user_id=entities.annotator_id, email="alex.annotator@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "query": "What is occlusion?",
        "response_content": "Occlusion occurs when an object is partially or fully hidden...",
        "rating": "like",
        "project_id": str(entities.project_id),
    }

    response = await client.post("/api/v1/chat/feedback", headers=headers, json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "RECORDED"
    assert "id" in data


@pytest.mark.asyncio
async def test_submit_negative_feedback_with_reason(client: AsyncClient):
    """Employee submits negative feedback with gap reason categorization."""
    token = create_access_token(user_id=entities.annotator_id, email="alex.annotator@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "query": "Do emergency strobe lights require dynamic bounding box expansion?",
        "response_content": "No specific guidance found in the SOP...",
        "rating": "dislike",
        "reason": "Missing guideline in SOP",
        "comment": "Annotators need clarification for emergency strobe light envelopes.",
        "project_id": str(entities.project_id),
    }

    response = await client.post("/api/v1/chat/feedback", headers=headers, json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "RECORDED"
    assert "Admin Knowledge Gap Queue" in data["message"]


# =============================================================================
# 2. KNOWLEDGE GAP RESOLUTION & AUTO-REINDEXING TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_resolve_knowledge_gap_endpoint(client: AsyncClient):
    """Admin resolves the identified gap by indexing the missing SOP guideline."""
    admin_token = create_access_token(user_id=entities.admin_id, email="sarah.admin@autocruise.test")
    headers = {"Authorization": f"Bearer {admin_token}"}

    payload = {
        "unanswered_id": str(uuid.uuid4()),
        "query": "Do emergency strobe lights require dynamic bounding box expansion?",
        "document_title": "Urban LiDAR 3D Annotation SOP",
        "section_name": "Emergency Vehicle Strobe Luminance & Envelope",
        "page_number": 34,
        "new_guideline_content": "Emergency vehicles with active strobe lights must be bounded to the physical vehicle body only; strobe light optical flares are excluded from the 3D bounding cuboid.",
        "project_id": str(entities.project_id),
    }

    response = await client.post("/api/v1/admin/knowledge-gaps/resolve", headers=headers, json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "RESOLVED"
    assert data["document_title"] == "Urban LiDAR 3D Annotation SOP"
    assert data["section_name"] == "Emergency Vehicle Strobe Luminance & Envelope"
    assert data["vector_dimension"] == 1024
    assert data["embedding_model"] == "BAAI/bge-m3"
    assert "chunk_id" in data
