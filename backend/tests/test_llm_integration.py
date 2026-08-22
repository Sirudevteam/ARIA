"""
Comprehensive Automated Test Suite for LLM Provider Abstraction & DeepSeek Integration.
Tests Provider Abstraction, Factory Resolution, DeepSeek Payload Formatting,
Server-Sent Events (SSE) Streaming, Prompt Composition, and RAG Chat Endpoints.
"""

from datetime import datetime, timezone
import json
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
from app.schemas.llm import ChatMessage, LLMResponse, LLMStreamChunk, TokenUsage
from app.schemas.reranker import RerankedChunk
from app.services.embedding.providers.bge_m3 import BGEM3EmbeddingProvider
from app.services.llm.base import BaseLLMProvider
from app.services.llm.factory import get_llm_provider, register_llm_provider
from app.services.llm.providers.deepseek import DeepSeekProvider
from app.services.llm.providers.mock import MockLLMProvider
from app.services.llm.providers.openai import OpenAILLMProvider
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

settings = get_settings()

TEST_DB_FILE = f"test_llm_{uuid.uuid4().hex[:8]}.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


class TestEntities:
    org_id: uuid.UUID
    admin_id: uuid.UUID
    project_id: uuid.UUID
    doc_id: uuid.UUID


entities = TestEntities()


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_test_database():
    """Create test SQLite database and seed initial fixtures."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # Organization
        org = Organization(name="Autocruise Dynamics AI", slug="autocruise", is_active=True)
        session.add(org)
        await session.flush()
        entities.org_id = org.id

        # Role
        r_admin = Role(name="ADMIN", scope=RoleScope.organization, permissions=["*"], is_system=True)
        session.add(r_admin)
        await session.flush()

        # User
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

        # Project
        proj = Project(organization_id=org.id, name="Urban 3D Perception", status=ProjectStatus.active)
        session.add(proj)
        await session.flush()
        entities.project_id = proj.id

        # Document
        doc = Document(
            id=uuid.uuid4(),
            project_id=proj.id,
            organization_id=org.id,
            uploaded_by=u_admin.id,
            title="ISO 8855 Coordinate Frame Standard Guide",
            doc_type=DocType.annotation_schema,
            status=DocStatus.ready,
            confidentiality="internal",
        )
        session.add(doc)
        entities.doc_id = doc.id

        v1 = DocumentVersion(id=uuid.uuid4(), document_id=doc.id, version_number=1, storage_path="storage/guide.md", is_current=True)
        session.add(v1)

        c1 = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_id=v1.id,
            chunk_index=0,
            content="LiDAR sensor coordinate system uses ISO 8855 standard orientation with X forward, Y left, and Z up for 3D bounding box alignment.",
            token_count=24,
            status=ChunkStatus.embedded,
            metadata_={"page_number": 2, "section": "ISO 8855 Coordinate Standards"},
        )
        session.add(c1)
        await session.flush()

        # Embed chunk
        provider = BGEM3EmbeddingProvider(dimensions=1024)
        vectors = await provider.embed_texts([c1.content])
        c1.embedding = vectors[0]

        await session.commit()

    yield

    await engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


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
# 1. LLM PROVIDER ABSTRACTION & FACTORY TESTS
# =============================================================================

def test_llm_factory_resolution():
    """Verify dynamic resolution of LLM providers (DeepSeek, OpenAI, Mock)."""
    # DeepSeek Provider
    ds = get_llm_provider("deepseek")
    assert isinstance(ds, DeepSeekProvider)
    assert ds.provider_name == "deepseek"
    assert "deepseek:" in ds.get_model_identifier()

    # OpenAI Provider
    oai = get_llm_provider("openai")
    assert isinstance(oai, OpenAILLMProvider)
    assert oai.provider_name == "openai"

    # Mock Provider
    mock_p = get_llm_provider("mock")
    assert isinstance(mock_p, MockLLMProvider)
    assert mock_p.provider_name == "mock"


def test_custom_llm_provider_registration():
    """Verify runtime registration of custom LLM providers."""
    class AnthropicProvider(BaseLLMProvider):
        @property
        def provider_name(self) -> str:
            return "anthropic"

        @property
        def model_name(self) -> str:
            return "claude-3-5-sonnet"

        async def generate(self, messages, **kwargs) -> LLMResponse:
            return LLMResponse(
                content="Claude response",
                model="claude-3-5-sonnet",
                usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
                latency_ms=12.0,
            )

        async def generate_stream(self, messages, **kwargs):
            yield LLMStreamChunk(delta="Claude stream", done=False)
            yield LLMStreamChunk(delta="", done=True)

    register_llm_provider("anthropic", AnthropicProvider)
    resolved = get_llm_provider("anthropic")
    assert isinstance(resolved, AnthropicProvider)
    assert resolved.get_model_identifier() == "anthropic:claude-3-5-sonnet"


# =============================================================================
# 2. DEEPSEEK PROVIDER GENERATION & STREAMING TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_deepseek_generation_and_payload_assembly():
    """
    Test DeepSeek message formatting and non-streaming response structure.
    """
    provider = DeepSeekProvider(model_name="deepseek-chat")
    messages = [
        ChatMessage(role="user", content="What is the ISO 8855 axis convention?"),
    ]

    response = await provider.generate(
        messages=messages,
        system_prompt="You are ARIA, an annotation AI assistant.",
        temperature=0.1,
    )

    assert response.content is not None
    assert len(response.content) > 0
    assert response.usage.total_tokens > 0
    assert response.latency_ms > 0
    assert "ISO 8855" in response.content


@pytest.mark.asyncio
async def test_deepseek_sse_streaming():
    """
    Test DeepSeek Server-Sent Events (SSE) token-by-token stream generator.
    """
    provider = DeepSeekProvider(model_name="deepseek-chat")
    messages = [
        ChatMessage(role="user", content="Explain coordinate axes."),
    ]

    tokens: List[str] = []
    has_done = False

    async for chunk in provider.generate_stream(messages=messages):
        if chunk.done:
            has_done = True
            assert chunk.usage is not None
        else:
            tokens.append(chunk.delta)

    assert has_done is True
    assert len(tokens) > 0
    assert "".join(tokens).strip() != ""


# =============================================================================
# 3. RAG PROMPT COMPOSER TESTS
# =============================================================================

def test_prompt_composer_with_numbered_citations():
    """
    Verify prompt composer formats verified context with [Citation X], document titles,
    pages, and sections without hallucination.
    """
    citation_1 = RerankedChunk(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_title="Velodyne VLS-128 Calibration Guide",
        doc_type="annotation_schema",
        version_number=2,
        page=2,
        section="ISO 8855 Coordinate Standards",
        content="LiDAR sensor coordinate system uses ISO 8855 standard orientation with X forward, Y left, and Z up.",
        combined_score=0.92,
        rerank_score=0.985,
        rerank_rank=1,
        original_rank=1,
        rank_delta=0,
    )

    messages = prompt_composer.compose_messages(
        query="What are the LiDAR coordinate axes?",
        citations=[citation_1],
        conversation_history=[
            ChatMessage(role="user", content="Hello"),
            ChatMessage(role="assistant", content="Hello! How can I assist with annotation today?"),
        ],
    )

    assert len(messages) == 4  # system + 2 history + current query
    system_msg = messages[0].content

    # Grounding checks
    assert "[Citation 1]" in system_msg
    assert "Velodyne VLS-128 Calibration Guide" in system_msg
    assert "Page: 2" in system_msg
    assert "ISO 8855 Coordinate Standards" in system_msg
    assert "Relevance: 98.5%" in system_msg
    assert "GROUNDING & CITATION RULES" in system_msg


# =============================================================================
# 4. END-TO-END RAG CHAT API ENDPOINTS TESTS
# =============================================================================

@pytest.mark.asyncio
async def test_api_rag_chat_completions(client: AsyncClient):
    """
    Test POST /api/v1/chat/completions non-streaming endpoint with verified citations.
    """
    token = create_access_token(user_id=entities.admin_id, email="lead@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "query": "What standard orientation do LiDAR coordinate axes use?",
        "project_id": str(entities.project_id),
        "stream": False,
        "candidate_k": 5,
        "top_k": 3,
        "min_relevance_threshold": 0.20,
    }

    resp = await client.post("/api/v1/chat/completions", headers=headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["query"] == "What standard orientation do LiDAR coordinate axes use?"
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert "citations" in data
    assert len(data["citations"]) >= 1
    assert data["citations"][0]["document_title"] == "ISO 8855 Coordinate Frame Standard Guide"
    assert "usage" in data
    assert data["usage"]["total_tokens"] > 0


@pytest.mark.asyncio
async def test_api_rag_chat_stream_sse(client: AsyncClient):
    """
    Test POST /api/v1/chat/stream Server-Sent Events (SSE) streaming endpoint.
    """
    token = create_access_token(user_id=entities.admin_id, email="lead@autocruise.test")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "query": "What is the ISO 8855 coordinate standard?",
        "project_id": str(entities.project_id),
        "stream": True,
    }

    resp = await client.post("/api/v1/chat/stream", headers=headers, json=payload)
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]

    # Read SSE events
    body_text = resp.text
    lines = [line for line in body_text.split("\n") if line.startswith("data: ")]
    assert len(lines) >= 2  # Citations event + done event

    # First event: Citations
    first_event = json.loads(lines[0][6:])
    assert first_event["type"] == "citations"
    assert "citations" in first_event

    # Last event: Done
    last_event = json.loads(lines[-1][6:])
    assert last_event["type"] == "done"
    assert "usage" in last_event
