"""
Comprehensive Automated Test Suite for Enterprise Admin Dashboard API Endpoints.
Verifies 6 core KPIs, 87 unanswered queries queue, AI token usage telemetry,
feedback analytics, and RBAC authorization guards (403 for Annotators, 200 for Admins).
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

TEST_DB_FILE = f"test_admin_{uuid.uuid4().hex[:8]}.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


class TestEntities:
    org_id: uuid.UUID
    admin_id: uuid.UUID
    annotator_id: uuid.UUID
    project_id: uuid.UUID


entities = TestEntities()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_test_database():
    """Create test SQLite database and seed initial fixtures once for the test module."""
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
            slug="autocruise-admin",
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
# 1. ADMIN OVERVIEW KPIS & METRICS TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_admin_kpis_overview_endpoint(client: AsyncClient):
    """Admin successfully fetches the 6 core platform KPI metrics."""
    token = create_access_token(user_id=entities.admin_id, email="sarah.admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get("/api/v1/admin/stats/overview", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["total_documents"] >= 248
    assert data["total_users"] >= 64
    assert data["total_projects"] >= 8
    assert data["total_questions"] == 4821
    assert data["total_feedback"] == 3912
    assert data["total_failed_queries"] == 87
    assert data["positive_feedback_rate"] == 0.942
    assert "avg_latency_ms" in data


# =============================================================================
# 2. UNANSWERED QUESTIONS QUEUE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_unanswered_questions_queue_endpoint(client: AsyncClient):
    """Admin fetches the queue of 87 unanswered / low-confidence queries."""
    token = create_access_token(user_id=entities.admin_id, email="sarah.admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get("/api/v1/admin/unanswered-questions", headers=headers)
    assert response.status_code == 200

    items = response.json()
    assert len(items) > 0
    first = items[0]
    assert "query" in first
    assert "confidence_score" in first
    assert "status" in first
    assert "project_name" in first


@pytest.mark.asyncio
async def test_unanswered_questions_filter(client: AsyncClient):
    """Admin filters unanswered queries queue by status."""
    token = create_access_token(user_id=entities.admin_id, email="sarah.admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get("/api/v1/admin/unanswered-questions?status_filter=added_to_sop", headers=headers)
    assert response.status_code == 200
    items = response.json()
    for item in items:
        assert item["status"] == "added_to_sop"


# =============================================================================
# 3. AI USAGE & TOKEN TELEMETRY TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_ai_usage_telemetry_endpoint(client: AsyncClient):
    """Admin fetches DeepSeek AI token telemetry and cost metrics."""
    token = create_access_token(user_id=entities.admin_id, email="sarah.admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get("/api/v1/admin/ai-usage", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["total_prompt_tokens"] > 0
    assert data["total_completion_tokens"] > 0
    assert data["total_tokens"] == data["total_prompt_tokens"] + data["total_completion_tokens"]
    assert data["active_model"] == "deepseek-chat"
    assert data["active_embedding_model"] == "BAAI/bge-m3"
    assert data["active_reranker_model"] == "BAAI/bge-reranker-v2-m3"


# =============================================================================
# 4. QA FEEDBACK ANALYTICS TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_feedback_analytics_endpoint(client: AsyncClient):
    """Admin fetches 3,912 QA feedback ratings breakdown."""
    token = create_access_token(user_id=entities.admin_id, email="sarah.admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get("/api/v1/admin/feedback-analytics", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["total_feedback"] == 3912
    assert data["positive_count"] == 3685
    assert data["negative_count"] == 227
    assert data["satisfaction_rate"] == 94.2
    assert len(data["top_negative_reasons"]) > 0


# =============================================================================
# 5. ZERO-TRUST AUDIT LOGS TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_audit_logs_endpoint(client: AsyncClient):
    """Admin fetches zero-trust security audit logs."""
    token = create_access_token(user_id=entities.admin_id, email="sarah.admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get("/api/v1/admin/audit-logs?limit=5", headers=headers)
    assert response.status_code == 200

    logs = response.json()
    assert len(logs) > 0
    assert "actor_email" in logs[0]
    assert "action" in logs[0]
    assert "resource_name" in logs[0]
    assert "status" in logs[0]


# =============================================================================
# 6. RBAC AUTHORIZATION GUARD TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_admin_rbac_guard_blocks_annotator(client: AsyncClient):
    """Non-admin user (Annotator) attempting to access Admin endpoints is blocked with HTTP 403."""
    annotator_token = create_access_token(user_id=entities.annotator_id, email="alex.annotator@autocruise.test")
    headers = {"Authorization": f"Bearer {annotator_token}"}

    response = await client.get("/api/v1/admin/stats/overview", headers=headers)
    assert response.status_code == 403
    assert "Access forbidden" in response.json()["detail"]
