"""
Comprehensive Automated Test Suite for Document Management System.
Tests Document Upload, Multi-Versioning, Lifecycle States, Search, Archive, Access Control, and Deletion.
"""

from datetime import datetime, timedelta, timezone
import io
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
from app.models.department import Department
from app.models.document import DocStatus, DocType, Document, DocumentVersion
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

TEST_DB_FILE = "test_doc_mgmt_temp.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


class TestEntities:
    org_id: uuid.UUID
    dept_id: uuid.UUID
    admin_id: uuid.UUID
    annotator_id: uuid.UUID
    outsider_id: uuid.UUID
    project1_id: uuid.UUID
    project2_id: uuid.UUID
    doc1_id: uuid.UUID


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
            name="Autocruise Dynamics AI",
            slug="autocruise",
            is_active=True,
        )
        session.add(org)
        await session.flush()
        entities.org_id = org.id

        # 2. Department
        dept = Department(
            organization_id=org.id,
            name="Perception & Calibration",
            description="Perception algorithms and 3D LiDAR annotation guidelines",
        )
        session.add(dept)
        await session.flush()
        entities.dept_id = dept.id

        # 3. Roles
        r_admin = Role(name="ADMIN", scope=RoleScope.organization, permissions=["org.*", "user.*", "document.*"], is_system=True)
        r_annot = Role(name="ANNOTATOR", scope=RoleScope.project, permissions=["annotation.*"], is_system=True)
        session.add_all([r_admin, r_annot])
        await session.flush()

        # 4. Users
        u_admin = User(
            organization_id=org.id,
            role_id=r_admin.id,
            email="admin@autocruise.test",
            name="Sarah Chen (Admin)",
            status=UserStatus.active,
        )
        u_annot = User(
            organization_id=org.id,
            role_id=r_annot.id,
            email="alex@autocruise.test",
            name="Alex Rivera (Annotator)",
            status=UserStatus.active,
        )
        u_outsider = User(
            organization_id=org.id,
            role_id=r_annot.id,
            email="outsider@autocruise.test",
            name="Outsider User",
            status=UserStatus.active,
        )
        session.add_all([u_admin, u_annot, u_outsider])
        await session.flush()

        entities.admin_id = u_admin.id
        entities.annotator_id = u_annot.id
        entities.outsider_id = u_outsider.id

        # 5. Projects
        p1 = Project(
            organization_id=org.id,
            name="Project Alpha (Urban 3D)",
            status=ProjectStatus.active,
        )
        p2 = Project(
            organization_id=org.id,
            name="Project Beta (Restricted)",
            status=ProjectStatus.active,
        )
        session.add_all([p1, p2])
        await session.flush()

        entities.project1_id = p1.id
        entities.project2_id = p2.id

        # 6. Memberships (Annotator in Project 1 ONLY)
        pm1 = ProjectMember(project_id=p1.id, user_id=u_annot.id, role_id=r_annot.id)
        session.add(pm1)

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
# 1. DOCUMENT UPLOAD & INITIALIZATION TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_upload_document_success(client: AsyncClient):
    """Admin successfully uploads a Markdown SOP document with full metadata."""
    token = create_access_token(user_id=entities.admin_id, email="admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    sample_md_content = b"# LiDAR 3D Bounding Box SOP\n\nGuidelines for 3D cuboid labeling on Velodyne VLS-128 point clouds."
    files = {"file": ("lidar_sop_v1.md", sample_md_content, "text/markdown")}
    data = {
        "title": "Urban LiDAR 3D Annotation SOP",
        "description": "Standard operating procedure for 3D bounding cuboids in urban traffic.",
        "doc_type": "annotation_schema",
        "department_id": str(entities.dept_id),
        "author": "Dr. Sarah Chen",
        "confidentiality": "confidential",
        "language": "en",
    }

    resp = await client.post(
        f"/api/v1/projects/{entities.project1_id}/documents/upload",
        headers=headers,
        data=data,
        files=files,
    )
    assert resp.status_code == 201
    res_data = resp.json()
    assert res_data["title"] == "Urban LiDAR 3D Annotation SOP"
    assert res_data["doc_type"] == "annotation_schema"
    assert res_data["status"] == "READY"
    assert res_data["confidentiality"] == "confidential"
    assert res_data["author"] == "Dr. Sarah Chen"
    assert res_data["current_version_number"] == 1
    assert len(res_data["versions"]) == 1
    assert res_data["versions"][0]["version_number"] == 1
    assert res_data["versions"][0]["is_current"] is True

    entities.doc1_id = uuid.UUID(res_data["id"])


# =============================================================================
# 2. MULTI-VERSIONING WORKFLOW TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_upload_new_document_version(client: AsyncClient):
    """Admin uploads version 2 with updated SOP guidelines and change summary."""
    token = create_access_token(user_id=entities.admin_id, email="admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    sample_v2_content = b"# LiDAR 3D Bounding Box SOP v2\n\nAdded occlusion threshold rules and heading vector guidelines."
    files = {"file": ("lidar_sop_v2.md", sample_v2_content, "text/markdown")}
    data = {"change_summary": "Added occlusion thresholds and heading vectors"}

    resp = await client.post(
        f"/api/v1/documents/{entities.doc1_id}/versions",
        headers=headers,
        data=data,
        files=files,
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["current_version_number"] == 2
    assert len(res_data["versions"]) == 2

    # Verify v2 is current and v1 is not current
    v2 = next(v for v in res_data["versions"] if v["version_number"] == 2)
    v1 = next(v for v in res_data["versions"] if v["version_number"] == 1)
    assert v2["is_current"] is True
    assert v2["change_summary"] == "Added occlusion thresholds and heading vectors"
    assert v1["is_current"] is False


# =============================================================================
# 3. SEARCH & FILTER TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_list_and_search_documents(client: AsyncClient):
    """Search documents across title/description and filter by project and status."""
    token = create_access_token(user_id=entities.admin_id, email="admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Search by keyword
    resp = await client.get("/api/v1/documents?q=Urban", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    assert any("Urban" in item["title"] for item in resp.json()["items"])

    # 2. Filter by status READY
    resp_ready = await client.get("/api/v1/documents?status=READY", headers=headers)
    assert resp_ready.status_code == 200
    assert all(item["status"] == "READY" for item in resp_ready.json()["items"])

    # 3. Filter by project
    resp_proj = await client.get(f"/api/v1/documents?project_id={entities.project1_id}", headers=headers)
    assert resp_proj.status_code == 200
    assert all(item["project_id"] == str(entities.project1_id) for item in resp_proj.json()["items"])


# =============================================================================
# 4. LIFECYCLE: ARCHIVE & UNARCHIVE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_archive_and_unarchive_document(client: AsyncClient):
    """Admin archives a document and then unarchives it back to READY."""
    token = create_access_token(user_id=entities.admin_id, email="admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Archive
    resp_arch = await client.patch(f"/api/v1/documents/{entities.doc1_id}/archive?archive=true", headers=headers)
    assert resp_arch.status_code == 200
    assert resp_arch.json()["status"] == "ARCHIVED"

    # 2. Unarchive back to READY
    resp_unarch = await client.patch(f"/api/v1/documents/{entities.doc1_id}/archive?archive=false", headers=headers)
    assert resp_unarch.status_code == 200
    assert resp_unarch.json()["status"] == "READY"


# =============================================================================
# 5. VALIDATION & SECURITY FAILURE TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_reject_unsupported_file_type(client: AsyncClient):
    """Uploading an unsupported file type (.exe) must return 400 Bad Request."""
    token = create_access_token(user_id=entities.admin_id, email="admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("malicious.exe", b"binary executable content", "application/x-msdownload")}
    data = {"title": "Invalid File"}

    resp = await client.post(
        f"/api/v1/projects/{entities.project1_id}/documents/upload",
        headers=headers,
        data=data,
        files=files,
    )
    assert resp.status_code == 400
    assert "Unsupported file type" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_reject_unauthorized_project_access(client: AsyncClient):
    """Outsider user attempting to access document in unassigned project receives 403 Forbidden."""
    token = create_access_token(user_id=entities.outsider_id, email="outsider@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get(f"/api/v1/documents/{entities.doc1_id}", headers=headers)
    assert resp.status_code == 403
    assert "permission to view documents in this project" in resp.json()["detail"]


# =============================================================================
# 6. DOCUMENT DELETION TEST
# =============================================================================

@pytest.mark.asyncio
async def test_delete_document_success(client: AsyncClient):
    """Admin deletes a document, removing DB record and version storage files."""
    token = create_access_token(user_id=entities.admin_id, email="admin@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    # Delete
    resp_del = await client.delete(f"/api/v1/documents/{entities.doc1_id}", headers=headers)
    assert resp_del.status_code == 200
    assert resp_del.json()["success"] is True

    # Subsequent GET returns 404
    resp_get = await client.get(f"/api/v1/documents/{entities.doc1_id}", headers=headers)
    assert resp_get.status_code == 404
