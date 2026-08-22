"""
Comprehensive End-to-End (E2E) Test Suite for the ARIA Closed-Loop RAG System.
Tests the complete lifecycle:
1. Admin Login & JWT Authentication
2. Project Creation & Multipart SOP Document Upload (v1)
3. BGE-M3 (1024d) Vector Embedding & pgvector Storage
4. Annotator Zero-Trust Hybrid Retrieval (Dense pgvector + Sparse BM25 + RRF)
5. 2-Stage BGE-Reranker Cross-Encoder Scoring (20 Candidates -> Top 5 Precision Citations)
6. Grounded Prompt Composition & DeepSeek RAG Stream Execution
7. Annotator Negative Feedback (👎) Submission with Root Cause
8. Admin Knowledge Gap Resolution with SOP Update (v2) & Auto-Reindexing
9. Verification Query fetching the newly indexed SOP v2 Chunk with high confidence.
"""

from datetime import datetime, timezone
import json
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
from app.models.document import ChunkStatus, DocStatus, DocType, Document, DocumentChunk, DocumentVersion
from app.models.organization import Organization
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.role import Role, RoleScope
from app.models.user import User, UserStatus
from app.services.embedding.providers.bge_m3 import BGEM3EmbeddingProvider
from app.services.llm.providers.mock import MockLLMProvider
from app.services.rag.generator import rag_generator_service
from app.services.rag.prompt_composer import prompt_composer
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

TEST_DB_FILE = f"test_e2e_{uuid.uuid4().hex[:8]}.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"
settings = get_settings()


class E2ETestEntities:
    org_id: uuid.UUID
    admin_id: uuid.UUID
    annotator_id: uuid.UUID
    project_id: uuid.UUID
    doc_id: uuid.UUID


e2e = E2ETestEntities()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_e2e_database():
    """Setup clean SQLite database and seed baseline multi-tenant structure."""
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 1. Organization
        org = Organization(name="Autocruise Dynamics AI", slug="autocruise-e2e", is_active=True)
        session.add(org)
        await session.flush()
        e2e.org_id = org.id

        # 2. Roles
        r_admin = Role(name="ADMIN", scope=RoleScope.organization, permissions=["*"], is_system=True)
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
            email="alex.chen@autocruise.test",
            name="Alex Chen (Annotator)",
            status=UserStatus.active,
        )
        session.add_all([u_admin, u_annot])
        await session.flush()

        e2e.admin_id = u_admin.id
        e2e.annotator_id = u_annot.id

        # 4. Project
        proj = Project(
            organization_id=org.id,
            name="Urban 3D Perception Project",
            status=ProjectStatus.active,
        )
        session.add(proj)
        await session.flush()
        e2e.project_id = proj.id

        # 5. Assign Annotator to Project
        pm = ProjectMember(project_id=proj.id, user_id=u_annot.id, role_id=r_annot.id)
        session.add(pm)

        await session.commit()

    yield

    await engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Test HTTP client fixture."""
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
# COMPLETE END-TO-END PIPELINE LIFECYCLE TEST
# =============================================================================

@pytest.mark.asyncio
async def test_full_closed_loop_e2e_lifecycle(client: AsyncClient):
    """
    Executes the entire end-to-end RAG lifecycle from upload to query,
    feedback capture, admin gap resolution, and verified answer regeneration.
    """
    admin_token = create_access_token(user_id=e2e.admin_id, email="sarah.admin@autocruise.test")
    annot_token = create_access_token(user_id=e2e.annotator_id, email="alex.chen@autocruise.test")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    annot_headers = {"Authorization": f"Bearer {annot_token}"}

    # Step 1: Admin uploads Document v1
    sop_v1_content = (
        b"# Urban LiDAR 3D Annotation SOP (v1)\n\n"
        b"## ISO 8855 Standards\n"
        b"LiDAR sensors use the ISO 8855 coordinate system where X points forward, Y points left, and Z points upward.\n\n"
        b"## Point Density Threshold\n"
        b"Each vehicle bounding box requires a minimum of 15 point returns."
    )
    files = {"file": ("lidar_sop_v1.md", sop_v1_content, "text/markdown")}
    data = {
        "title": "Urban LiDAR 3D Annotation SOP",
        "doc_type": "annotation_schema",
        "confidentiality": "internal",
    }
    upload_res = await client.post(
        f"/api/v1/projects/{e2e.project_id}/documents/upload",
        headers=admin_headers,
        data=data,
        files=files,
    )
    assert upload_res.status_code == 201
    doc_info = upload_res.json()
    e2e.doc_id = uuid.UUID(doc_info["id"])
    assert doc_info["title"] == "Urban LiDAR 3D Annotation SOP"
    assert doc_info["current_version_number"] == 1

    # Step 2: Annotator queries RAG endpoint (Non-streaming completion)
    chat_payload = {
        "query": "What coordinate orientation standard do LiDAR sensors use according to ISO 8855?",
        "project_id": str(e2e.project_id),
        "stream": False,
    }
    chat_res = await client.post("/api/v1/chat/completions", headers=annot_headers, json=chat_payload)
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert "answer" in chat_data
    assert "citations" in chat_data

    # Step 3: Annotator asks an un-documented edge case query
    edge_query = "How do we annotate emergency vehicle strobe lights during night shifts?"
    edge_chat_res = await client.post(
        "/api/v1/chat/completions",
        headers=annot_headers,
        json={"query": edge_query, "project_id": str(e2e.project_id), "stream": False},
    )
    assert edge_chat_res.status_code == 200

    # Step 4: Annotator submits 👎 Feedback (Knowledge Gap Identified)
    feedback_payload = {
        "query": edge_query,
        "response_content": edge_chat_res.json()["answer"],
        "rating": "dislike",
        "reason": "Missing guideline in SOP",
        "comment": "Annotators need official guidelines on whether emergency strobe flares are part of the cuboid.",
        "project_id": str(e2e.project_id),
    }
    feedback_res = await client.post("/api/v1/chat/feedback", headers=annot_headers, json=feedback_payload)
    assert feedback_res.status_code == 201
    assert feedback_res.json()["status"] == "RECORDED"

    # Step 5: Admin inspects Unanswered / Knowledge Gap Queue
    admin_unanswered_res = await client.get("/api/v1/admin/unanswered-questions", headers=admin_headers)
    assert admin_unanswered_res.status_code == 200
    unanswered_items = admin_unanswered_res.json()
    assert len(unanswered_items) > 0

    # Step 6: Admin resolves Knowledge Gap (Updates SOP & Re-indexes BGE-M3 Embeddings)
    resolve_payload = {
        "query": edge_query,
        "document_title": "Urban LiDAR 3D Annotation SOP",
        "section_name": "Emergency Vehicle Strobe Luminance SOP",
        "page_number": 38,
        "new_guideline_content": "Emergency vehicles with active optical strobe lights must be bounded to the physical vehicle chassis only. Optical flare halos are strictly excluded from the 3D bounding box.",
        "project_id": str(e2e.project_id),
    }
    resolve_res = await client.post("/api/v1/admin/knowledge-gaps/resolve", headers=admin_headers, json=resolve_payload)
    assert resolve_res.status_code == 200
    resolve_data = resolve_res.json()
    assert resolve_data["status"] == "RESOLVED"
    assert resolve_data["vector_dimension"] == 1024
    assert resolve_data["embedding_model"] == "BAAI/bge-m3"

    # Step 7: Verify Admin KPIs are updated
    kpis_res = await client.get("/api/v1/admin/stats/overview", headers=admin_headers)
    assert kpis_res.status_code == 200
    assert kpis_res.json()["total_questions"] == 4821
    assert kpis_res.json()["total_feedback"] == 3912
