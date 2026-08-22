"""
Unit & Integration Tests for Authentication and Multi-Layer Authorization.
Tests 401 unauthenticated, 403 status/role/project/document failures, and 200 success flows.
"""

from datetime import datetime, timedelta, timezone
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
from app.models.document import DocStatus, DocType, Document
from app.models.organization import Organization
from app.models.project import Project, ProjectMember, ProjectStatus
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

settings = get_settings()

TEST_DB_FILE = "test_auth_temp.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


class TestEntities:
    org_id: uuid.UUID
    admin_id: uuid.UUID
    annotator_id: uuid.UUID
    suspended_id: uuid.UUID
    viewer_id: uuid.UUID
    project1_id: uuid.UUID
    project2_id: uuid.UUID
    doc1_id: uuid.UUID
    doc2_id: uuid.UUID


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
        org = Organization(
            name="Autocruise AI Test",
            slug="autocruise-test",
            is_active=True,
        )
        session.add(org)
        await session.flush()
        entities.org_id = org.id

        # 2. Roles
        r_super = Role(name="SUPER_ADMIN", scope=RoleScope.system, permissions=["*"], is_system=True)
        r_admin = Role(name="ADMIN", scope=RoleScope.organization, permissions=["org.*", "user.*"], is_system=True)
        r_mgr   = Role(name="MANAGER", scope=RoleScope.organization, permissions=["project.*"], is_system=True)
        r_annot = Role(name="ANNOTATOR", scope=RoleScope.project, permissions=["annotation.*"], is_system=True)
        r_qc    = Role(name="QC", scope=RoleScope.project, permissions=["qc.*"], is_system=True)
        r_view  = Role(name="VIEWER", scope=RoleScope.project, permissions=["read"], is_system=True)
        session.add_all([r_super, r_admin, r_mgr, r_annot, r_qc, r_view])
        await session.flush()

        # 3. Users
        u_admin = User(
            organization_id=org.id,
            role_id=r_admin.id,
            email="admin@autocruise.test",
            name="Admin User",
            status=UserStatus.active,
        )
        u_annot = User(
            organization_id=org.id,
            role_id=r_annot.id,
            email="annotator@autocruise.test",
            name="Annotator User",
            status=UserStatus.active,
        )
        u_suspended = User(
            organization_id=org.id,
            role_id=r_annot.id,
            email="suspended@autocruise.test",
            name="Suspended User",
            status=UserStatus.suspended,
        )
        u_viewer = User(
            organization_id=org.id,
            role_id=r_view.id,
            email="viewer@autocruise.test",
            name="Viewer User",
            status=UserStatus.active,
        )
        session.add_all([u_admin, u_annot, u_suspended, u_viewer])
        await session.flush()

        entities.admin_id = u_admin.id
        entities.annotator_id = u_annot.id
        entities.suspended_id = u_suspended.id
        entities.viewer_id = u_viewer.id

        # 4. Projects
        p1 = Project(
            organization_id=org.id,
            name="Project Alpha (Urban)",
            status=ProjectStatus.active,
        )
        p2 = Project(
            organization_id=org.id,
            name="Project Beta (Highway Restricted)",
            status=ProjectStatus.active,
        )
        session.add_all([p1, p2])
        await session.flush()

        entities.project1_id = p1.id
        entities.project2_id = p2.id

        # 5. Project Memberships (Annotator is ONLY in Project 1)
        pm1 = ProjectMember(project_id=p1.id, user_id=u_annot.id, role_id=r_annot.id)
        session.add(pm1)

        # 6. Documents
        doc_p1 = Document(
            project_id=p1.id,
            organization_id=org.id,
            title="Urban Shuttle 3D Labeling SOP",
            doc_type=DocType.manual,
            status=DocStatus.ready,
            language="en",
        )
        doc_p2 = Document(
            project_id=p2.id,
            organization_id=org.id,
            title="Highway Long-Range Confidential SOP",
            doc_type=DocType.spec,
            status=DocStatus.ready,
            language="en",
        )
        session.add_all([doc_p1, doc_p2])
        await session.flush()

        entities.doc1_id = doc_p1.id
        entities.doc2_id = doc_p2.id

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
# 1. 401 UNAUTHENTICATED TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_401_missing_auth_header(client: AsyncClient):
    """Requests without Authorization header must return 401."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401
    assert "Missing authentication credentials" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_401_invalid_jwt_token(client: AsyncClient):
    """Requests with malformed / invalid JWT must return 401."""
    headers = {"Authorization": "Bearer invalid.jwt.token"}
    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 401
    assert "Invalid authentication token" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_401_expired_jwt_token(client: AsyncClient):
    """Requests with expired JWT must return 401."""
    expired_token = create_access_token(
        user_id=entities.admin_id,
        email="admin@autocruise.test",
        expires_delta=timedelta(seconds=-3600),  # Expired 1 hour ago
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()


# =============================================================================
# 2. 403 STATUS & ROLE AUTHORIZATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_403_suspended_user(client: AsyncClient):
    """Suspended user must be rejected with 403 Forbidden."""
    token = create_access_token(
        user_id=entities.suspended_id,
        email="suspended@autocruise.test",
    )
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 403
    assert "suspended" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_403_insufficient_role_access(client: AsyncClient):
    """ANNOTATOR attempting to list users (/api/v1/users) must receive 403 Forbidden."""
    token = create_access_token(
        user_id=entities.annotator_id,
        email="annotator@autocruise.test",
    )
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/v1/users", headers=headers)
    assert resp.status_code == 403
    assert "Access forbidden: requires one of roles" in resp.json()["detail"]


# =============================================================================
# 3. 403 PROJECT & DOCUMENT MEMBERSHIP AUTHORIZATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_403_project_not_a_member(client: AsyncClient):
    """ANNOTATOR attempting to access Project 2 (where they have no membership) must receive 403."""
    token = create_access_token(
        user_id=entities.annotator_id,
        email="annotator@autocruise.test",
    )
    headers = {"Authorization": f"Bearer {token}"}
    # Project 2 (Beta)
    resp = await client.get(f"/api/v1/projects/{entities.project2_id}", headers=headers)
    assert resp.status_code == 403
    assert "not assigned as a member" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_403_document_access_without_project_membership(client: AsyncClient):
    """User attempting to view a document from a non-member project must receive 403."""
    token = create_access_token(
        user_id=entities.annotator_id,  # u_annot only in p1
        email="annotator@autocruise.test",
    )
    headers = {"Authorization": f"Bearer {token}"}
    # doc_p2 belongs to project 2
    resp = await client.get(f"/api/v1/documents/{entities.doc2_id}", headers=headers)
    assert resp.status_code == 403
    assert "permission to view documents in this project" in resp.json()["detail"]


# =============================================================================
# 4. 200 SUCCESSFUL AUTHORIZATION FLOWS
# =============================================================================

@pytest.mark.asyncio
async def test_200_profile_me_success(client: AsyncClient):
    """Valid user fetches their own profile with full authorization metadata."""
    token = create_access_token(
        user_id=entities.annotator_id,
        email="annotator@autocruise.test",
    )
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "annotator@autocruise.test"
    assert data["role"]["name"] == "ANNOTATOR"
    assert len(data["projects"]) == 1
    assert data["projects"][0]["project_name"] == "Project Alpha (Urban)"


@pytest.mark.asyncio
async def test_200_project_access_for_member(client: AsyncClient):
    """ANNOTATOR successfully accesses Project 1 (where they are assigned)."""
    token = create_access_token(
        user_id=entities.annotator_id,
        email="annotator@autocruise.test",
    )
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"/api/v1/projects/{entities.project1_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Project Alpha (Urban)"
    assert resp.json()["user_role"] == "ANNOTATOR"


@pytest.mark.asyncio
async def test_200_document_access_for_member(client: AsyncClient):
    """ANNOTATOR successfully views document metadata from their assigned project."""
    token = create_access_token(
        user_id=entities.annotator_id,
        email="annotator@autocruise.test",
    )
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(f"/api/v1/documents/{entities.doc1_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Urban Shuttle 3D Labeling SOP"


@pytest.mark.asyncio
async def test_200_admin_full_org_visibility(client: AsyncClient):
    """ADMIN role can list all users and all projects across the organization."""
    token = create_access_token(
        user_id=entities.admin_id,
        email="admin@autocruise.test",
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Admin lists users
    resp_users = await client.get("/api/v1/users", headers=headers)
    assert resp_users.status_code == 200
    assert len(resp_users.json()) >= 4

    # 2. Admin lists projects (sees both Project 1 and Project 2)
    resp_projs = await client.get("/api/v1/projects", headers=headers)
    assert resp_projs.status_code == 200
    assert len(resp_projs.json()) == 2

    # 3. Admin accesses Project 2 even without explicit project_members row
    resp_p2 = await client.get(f"/api/v1/projects/{entities.project2_id}", headers=headers)
    assert resp_p2.status_code == 200
    assert resp_p2.json()["name"] == "Project Beta (Highway Restricted)"
