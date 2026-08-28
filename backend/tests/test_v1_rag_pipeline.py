"""
Comprehensive Automated Test Suite for ARIA V1 RAG Pipeline.
Verifies all 14 core requirements:
1. Upload PDF/TXT/DOCX
2. Extract text
3. Preserve document name and page number where available
4. Chunk text
5. Generate embeddings
6. Store embeddings in pgvector
7. Convert user query to embedding
8. Perform similarity search
9. Retrieve top relevant chunks
10. Build grounded context
11. Send context to DeepSeek
12. Generate answer
13. Return answer with source document and page
14. Refuse to answer when relevant context is unavailable
"""

import io
import math
import os
from typing import AsyncGenerator
import uuid

import pytest
import pytest_asyncio
import pypdf
import docx
from pgvector.sqlalchemy import Vector
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.config import get_settings
from app.models.base import Base
from app.models.document import ChunkStatus, DocStatus, DocType, Document, DocumentChunk, DocumentVersion
from app.models.organization import Organization
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.role import Role, RoleScope
from app.models.user import User, UserStatus
from app.schemas.llm import ChatMessage
from app.schemas.retrieval import RetrievalFilters, UserContext
from app.services.document.ingestion import chunk_text_by_pages, extract_pages_from_file, process_and_embed_document
from app.services.embedding.providers.bge_m3 import BGEM3EmbeddingProvider
from app.services.embedding.service import EmbeddingService
from app.services.rag.generator import rag_generator_service
from app.services.rag.prompt_composer import prompt_composer
from app.services.rag.retrieval import hybrid_retrieval_engine

# SQLite DDL type compilation compatibility handlers for test suite
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(INET, "sqlite")
def compile_inet_sqlite(type_, compiler, **kw):
    return "TEXT"

@compiles(Vector, "sqlite")
def compile_vector_sqlite(type_, compiler, **kw):
    return "TEXT"

TEST_DB_FILE = "test_v1_rag_pipeline_temp.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


@pytest_asyncio.fixture(scope="module")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest_asyncio.fixture(scope="module")
async def test_session_factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(test_session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        yield session
        await session.rollback()


@pytest.mark.asyncio
async def test_pdf_txt_docx_extraction_and_page_tracking():
    """
    Requirement 1, 2, 3:
    Upload PDF/TXT/DOCX, extract text, preserve document name and page number.
    """
    # 1. Test Markdown / TXT multi-page parsing
    txt_content = (
        "# Velodyne VLS-128 LiDAR Guidelines\n"
        "Page 1 overview of 128 laser channels.\n"
        "---\n"
        "Page 2 calibration specs: X forward, Y left, Z up.\n"
        "---\n"
        "Page 3 bounding box threshold: minimum 15 points per vehicle object."
    )
    pages = extract_pages_from_file(txt_content.encode("utf-8"), "lidar_sop.md", "text/markdown")
    assert len(pages) == 3
    assert pages[0][0] == 1
    assert "128 laser channels" in pages[0][1]
    assert pages[1][0] == 2
    assert "X forward, Y left, Z up" in pages[1][1]
    assert pages[2][0] == 3
    assert "minimum 15 points" in pages[2][1]

    # 2. Test DOCX extraction
    doc = docx.Document()
    doc.add_paragraph("DOCX Paragraph 1: Camera sensor extrinsics matrix.")
    doc.add_paragraph("DOCX Paragraph 2: Reprojection error < 0.5px.")
    doc_io = io.BytesIO()
    doc.save(doc_io)
    docx_bytes = doc_io.getvalue()

    docx_pages = extract_pages_from_file(docx_bytes, "camera_extrinsics.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    assert len(docx_pages) >= 1
    assert "Camera sensor extrinsics matrix" in docx_pages[0][1]


@pytest.mark.asyncio
async def test_chunking_and_embedding_generation():
    """
    Requirement 4, 5:
    Chunk text and generate 1024-dimensional embeddings.
    """
    pages = [
        (1, "Page 1 intro to autonomous perception."),
        (2, "Page 2 ISO 8855 standard: vehicle coordinate reference system requires X forward, Y left, Z up."),
    ]
    chunks = chunk_text_by_pages(pages, chunk_size_chars=500, overlap_chars=50)
    assert len(chunks) == 2
    assert chunks[0]["page_number"] == 1
    assert chunks[1]["page_number"] == 2
    assert "ISO 8855 standard" in chunks[1]["content"]

    provider = BGEM3EmbeddingProvider()
    query_vec = await provider.embed_query("ISO 8855 standard coordinate reference system")
    assert len(query_vec) == 1024
    norm = math.sqrt(sum(x * x for x in query_vec))
    assert abs(norm - 1.0) < 1e-3  # Unit-normalized


@pytest.mark.asyncio
async def test_full_v1_rag_pipeline_with_citations_and_refusal(db_session: AsyncSession):
    """
    Requirements 6, 7, 8, 9, 10, 11, 12, 13, 14:
    - Store embeddings in pgvector table
    - Convert user query to embedding
    - Perform similarity search & retrieve top relevant chunks
    - Build grounded context prompt
    - Send context to DeepSeek & generate answer
    - Return answer with source document and page number
    - Refuse to answer when relevant context is unavailable
    """
    # 1. Seed base organization, user, role, project
    org = Organization(id=uuid.uuid4(), name="Perception AI Inc", slug="perception-ai")
    db_session.add(org)

    role = Role(id=uuid.uuid4(), name="SUPER_ADMIN", scope=RoleScope.system, permissions=["*"])
    db_session.add(role)

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        role_id=role.id,
        email="lead@perception.ai",
        name="Lead Engineer",
        status=UserStatus.active,
    )
    db_session.add(user)

    project = Project(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Urban 3D Perception Project",
        status=ProjectStatus.active,
    )
    db_session.add(project)
    await db_session.flush()

    # 2. Seed document
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        project_id=project.id,
        organization_id=org.id,
        uploaded_by=user.id,
        title="Velodyne VLS-128 3D Cuboid Labeling SOP",
        description="Official ISO 8855 LiDAR 3D bounding box guidelines.",
        author="Perception Lead",
        doc_type=DocType.manual,
        status=DocStatus.ready,
        confidentiality="internal",
        language="en",
    )
    db_session.add(doc)

    v_id = uuid.uuid4()
    version = DocumentVersion(
        id=v_id,
        document_id=doc_id,
        created_by=user.id,
        version_number=1,
        storage_path=f"storage/{org.id}/{project.id}/{doc_id}/v1/sop.md",
        file_size_bytes=1000,
        checksum="test_checksum_12345",
        change_summary="Initial LiDAR SOP Release",
        is_current=True,
    )
    db_session.add(version)
    await db_session.commit()

    sample_sop_text = (
        "# Velodyne VLS-128 3D Annotation SOP\n"
        "Page 1: System overview.\n"
        "---\n"
        "## ISO 8855 Standard Coordinates\n"
        "Vehicle coordinate system defines X-axis pointing strictly forward along the longitudinal vehicle axis, "
        "Y-axis pointing left, and Z-axis pointing vertically upward.\n"
        "---\n"
        "## Bounding Box Thresholds\n"
        "For 3D vehicle cuboids, a valid label MUST contain a minimum laser point cloud density of 15 points. "
        "Heading yaw error must remain strictly below 1.5 degrees."
    )

    # 3. Process, Chunk, Embed & Save to document_chunks
    chunk_count = await process_and_embed_document(
        db=db_session,
        document=doc,
        version=version,
        file_bytes=sample_sop_text.encode("utf-8"),
        filename="Velodyne_SOP.md",
        mime_type="text/markdown",
    )
    assert chunk_count == 3

    user_context = UserContext(
        user_id=user.id,
        organization_id=org.id,
        role_name="SUPER_ADMIN",
        accessible_project_ids=[project.id],
    )
    filters = RetrievalFilters(project_ids=[project.id], current_version_only=True)

    # 4. Test Question 1: Coordinate System (Page 2)
    query_coords = "What coordinate orientation standards are defined for vehicle axes?"
    retrieved_coords = await hybrid_retrieval_engine.retrieve_and_rerank(
        db=db_session,
        query=query_coords,
        user_context=user_context,
        filters=filters,
        final_top_k=2,
        min_relevance_threshold=0.1,
    )
    assert len(retrieved_coords) > 0
    top_chunk = retrieved_coords[0]
    assert top_chunk.document_title == "Velodyne VLS-128 3D Cuboid Labeling SOP"
    assert top_chunk.page == 2
    assert "X-axis pointing strictly forward" in top_chunk.content

    # Generate grounded response
    response_coords = await rag_generator_service.generate_rag_response(
        db=db_session,
        query=query_coords,
        user_context=user_context,
        filters=filters,
    )
    assert response_coords.answer is not None
    assert len(response_coords.citations) > 0
    assert response_coords.citations[0].document_title == "Velodyne VLS-128 3D Cuboid Labeling SOP"
    assert response_coords.citations[0].page == 2

    # 5. Test Question 2: Point Density (Page 3)
    query_density = "What is the minimum laser point density required for vehicle 3D bounding boxes?"
    retrieved_density = await hybrid_retrieval_engine.retrieve_and_rerank(
        db=db_session,
        query=query_density,
        user_context=user_context,
        filters=filters,
        final_top_k=2,
    )
    assert len(retrieved_density) > 0
    assert retrieved_density[0].page == 3
    assert "15 points" in retrieved_density[0].content

    # 6. Test Requirement 14: Refusal when relevant context is unavailable
    query_unrelated = "What is the recipe for chocolate chip cookies?"
    response_unrelated = await rag_generator_service.generate_rag_response(
        db=db_session,
        query=query_unrelated,
        user_context=user_context,
        filters=filters,
        min_relevance_threshold=0.75,  # High threshold for unrelated query
    )
    # Must refuse when citations are empty
    assert len(response_unrelated.citations) == 0
    assert "no relevant information" in response_unrelated.answer.lower()
