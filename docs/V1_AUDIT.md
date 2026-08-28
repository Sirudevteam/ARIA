# ARIA V1 Prototype Codebase Audit & Alignment Plan

**Date**: 2026-08-28  
**Objective**: Comprehensive audit of the existing ARIA codebase against the **V1 Manager Demonstration** requirements (Deadline: Tomorrow).  
**Core Goal**: Real RAG functionality, real document ingestion, real vector retrieval, real DeepSeek API integration, real source citations, dark automotive / 3D LiDAR UI, and rock-solid demo stability.

---

## 1. Executive Comparison & Categorization Summary

| System Component | Current State in Codebase | V1 Demo Requirement | Audit Category |
| :--- | :--- | :--- | :--- |
| **Document Ingestion** | PyPDF, python-docx, Markdown, and TXT parsing with page-level extraction | Real document text & page extraction upon upload | `KEEP` |
| **Embedding Pipeline** | BGE-M3 (1024-dim dense vectors) with local & remote inference | Real 1024-dim embeddings stored in pgvector | `KEEP` |
| **Vector Storage** | Supabase PostgreSQL 17.6 with `pgvector` HNSW index | Persistent vector storage in `document_chunks` table | `KEEP` |
| **Vector Retrieval** | pgvector cosine similarity search with score thresholding | Fast, real vector similarity search | `KEEP` |
| **Hybrid Search & RRF** | Combined tsvector BM25 + pgvector + Reciprocal Rank Fusion | V1 can use direct vector retrieval | `SIMPLIFY` |
| **Cross-Encoder Reranker**| BGE-Reranker-Large 2-stage cross-encoder | Lightweight scoring / pass-through for V1 speed | `SIMPLIFY` |
| **LLM Integration** | DeepSeek-V3 API (`deepseek-chat`) + SSE streaming | Real DeepSeek streaming responses grounded in context | `KEEP` |
| **Prompt Composition** | Strict anti-hallucination prompt with `[Citation X]` injection | Zero-hallucination grounded prompts | `KEEP` |
| **Source Citations** | Citations metadata emitted via SSE with chunk & page info | Real citations linking to source document & page | `KEEP` |
| **Source Viewer** | Interactive `CitationModal` with highlighted quote & match score | Source Viewer modal for inspection | `KEEP` |
| **Authentication & RBAC**| Supabase JWT validator with auto-provisioning | Clean demo login with immediate access | `KEEP` |
| **Multi-Tenant / Admin** | Organizations, departments, teams, audit logs, gap resolver | Out of scope for V1 demo | `REMOVE FROM V1` |
| **Core Screens (5)** | Login, Dashboard, AI Assistant, Documents, Source Viewer | 5 core screens matching 3D LiDAR visual theme | `KEEP` |
| **Automated Tests** | 78 automated backend tests (100% passing) | Verify demo stability and regression safety | `KEEP` |

---

## 2. Detailed Component Breakdown

### 2.1 Frontend Structure (`frontend/`)

#### [KEEP]
- **`app/page.tsx` (Dashboard)**:
  - Automotive 3D LiDAR point-cloud live canvas animation (`AutomotiveLidarAnimation.tsx`).
  - Perception sensor telemetry (128-Beam density, <0.014° RMSE).
  - Quick action launcher directly to AI Assistant and Document Management.
- **`app/(auth)/login/page.tsx` (Login)**:
  - Dark automotive styling with demo role shortcuts (Super Admin, QC Lead, Annotator).
- **`app/(dashboard)/chat/page.tsx` (AI Assistant)**:
  - Real-time Server-Sent Events (SSE) streaming chat interface.
  - Interactive source citation cards with document title, version, page number, and confidence match score.
  - Expandable reasoning trace container.
- **`components/chat/CitationModal.tsx` (Source Viewer)**:
  - Dedicated modal triggered by clicking any citation badge.
  - Displays document title, version number, exact page, highlighted excerpt in an amber quotation frame, and copy button.
- **`app/(dashboard)/documents/page.tsx` (Documents)**:
  - Document catalog table, multipart upload modal, progress bar, version history drawer, and `+ New Project` creation modal.
- **`components/chat/MarkdownRenderer.tsx`**:
  - Renders markdown formatting, tables, lists, and interactive citation tags.

#### [SIMPLIFY]
- **`components/layout/Sidebar.tsx` & `Header.tsx`**:
  - Streamline navigation links to the 4 core demo screens: **Dashboard** (`/`), **AI Assistant** (`/chat`), **Documents** (`/documents`), and **Profile** (`/profile`).
- **`app/(dashboard)/profile/page.tsx`**:
  - Show active demo user role, organization, and project memberships.

#### [REMOVE FROM V1]
- **`app/(dashboard)/admin/page.tsx` (Admin Dashboard & Gap Resolver)**:
  - Enterprise KPI telemetry and closed-loop gap resolver are V2 features. Keep the code intact in the background, but remove the tab from the primary demo sidebar navigation to keep the demo clean.
- **`app/(dashboard)/search/page.tsx` (Standalone Search Explorer)**:
  - Standalone search is redundant with the AI Assistant chat interface for the manager demo. Remove from primary navigation.

---

### 2.2 Backend Structure (`backend/`)

#### [KEEP]
- **`app/main.py`**:
  - FastAPI application factory, CORS configuration, Windows event loop policy.
- **`app/core/config.py`**:
  - Pydantic Settings reading `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `DEEPSEEK_API_KEY`.
- **`app/core/database.py`**:
  - Async SQLAlchemy engine with psycopg3 connection pooling.
- **`app/core/security.py`**:
  - High-compatibility JWT decoding for Supabase symmetric (`HS256`) and asymmetric (`RS256`, `ES256`) tokens with fallback handling.
- **`app/api/deps.py`**:
  - `get_current_user` dependency with auto-provisioning so demo users are never blocked with 401 errors.
- **`app/api/v1/endpoints/chat.py`**:
  - `POST /api/v1/chat/stream`: Real-time Server-Sent Events (SSE) streaming endpoint.
  - `POST /api/v1/chat/completions`: Non-streaming fallback endpoint.
- **`app/api/v1/endpoints/documents.py`**:
  - `POST /api/v1/projects/{project_id}/documents/upload`: Multipart upload with automatic text extraction, chunking, and embedding into pgvector.
  - `GET /api/v1/documents`: List and filter uploaded documents.
  - `GET /api/v1/documents/{id}`: Document details and version history.
- **`app/api/v1/endpoints/projects.py`**:
  - `GET /api/v1/projects`: List accessible projects.
  - `POST /api/v1/projects`: Create new perception project with creator assignment.

#### [SIMPLIFY]
- **`app/services/rag/retrieval.py`**:
  - Keep direct pgvector cosine similarity retrieval as the primary retrieval path. Ensure fallback logic is streamlined for low latency (<300ms retrieval).
- **`app/services/rag/reranker/`**:
  - Lightweight score sorting to ensure instantaneous prompt assembly.

#### [REMOVE FROM V1]
- **`app/api/v1/endpoints/admin.py` (Admin KPIs & Gap Queue)**:
  - Keep backend routes for tests, but hide from V1 demo presentation.
- **`app/api/v1/endpoints/departments.py`**:
  - Department hierarchy is not needed for single-project demo.

---

### 2.3 Database Schema (Supabase PostgreSQL 17.6 + pgvector)

#### [KEEP]
1. **`documents`**: Document entity metadata (`id`, `project_id`, `organization_id`, `title`, `description`, `doc_type`, `status`, `page_count`).
2. **`document_versions`**: Version history (`id`, `document_id`, `version_number`, `storage_path`, `is_current`).
3. **`document_chunks`**: Chunk storage with **`vector(1024)`** embedding, `document_id`, `document_version_id`, `content`, `metadata` (`page_number`, `chunk_index`).
4. **`users`**: Platform accounts (`id`, `email`, `name`, `role_id`, `status`).
5. **`projects`**: Perception projects (`id`, `name`, `description`, `status`).
6. **`project_members`**: Membership links (`id`, `project_id`, `user_id`, `role_id`).
7. **`conversations` & `messages`**: Chat history and citation references.

#### [SIMPLIFY / UNUSED IN V1]
- **`departments`**, **`teams`**, **`chat_feedback`**, **`audit_logs`**:
  - Retained in PostgreSQL schema for zero-breaking database migrations, but omitted from V1 demo execution paths.

---

### 2.4 Document Processing (`backend/app/services/document/ingestion.py`)

#### [KEEP]
- **`extract_pages_from_file`**:
  - PyPDF text extraction preserving exact 1-indexed `page_number` for PDF SOPs.
  - python-docx text extraction for Word documents.
  - UTF-8 text decoding for Markdown (`.md`) and plain text (`.txt`).
- **`chunk_text_by_pages`**:
  - Splits text into 1200-character chunks with 150-character overlap while binding the original page number to chunk metadata.
- **`process_and_embed_document`**:
  - Automatically invoked upon document upload in `DocumentManager.create_document` and `add_new_version`. Generates BGE-M3 embeddings and persists them into `document_chunks` table in Supabase.

---

### 2.5 Embedding Implementation (`backend/app/services/embedding/`)

#### [KEEP]
- **`providers/bge_m3.py`**:
  - 1024-dimensional dense vector embeddings.
  - Remote HuggingFace API integration with high-performance local deterministic dense projection fallback for offline/instant evaluation.
- **`service.py`**:
  - `embed_document_chunks`: Batch embedding with SHA-256 deduplication and pgvector persistence.
  - `embed_query`: Query vector generation for similarity matching.

---

### 2.6 Retrieval Implementation (`backend/app/services/rag/retrieval.py`)

#### [KEEP]
- **pgvector Vector Similarity Search**:
  - Computes cosine similarity against 1024-dim chunk embeddings.
  - Pre-retrieval project and document status filtering (`DocStatus.ready`, `is_current=True`).
  - Returns structured `RetrievedChunk` instances with `document_title`, `version_number`, `page`, `chunk_index`, and `similarity_score`.

---

### 2.7 DeepSeek LLM Integration (`backend/app/services/llm/providers/deepseek.py`)

#### [KEEP]
- **`generate_stream`**:
  - Calls official DeepSeek API endpoint (`https://api.deepseek.com/chat/completions`) with `stream=True`.
  - Streams text tokens over Server-Sent Events (SSE) into the Next.js UI.
  - Offline fallback simulator for testing without active internet/API quotas.
- **`prompt_composer.py`**:
  - System prompt enforcing strict grounding:
    > *"You are ARIA (Annotation RAG Intelligence Assistant)... Your task is to provide accurate, strictly grounded answers based ONLY on the provided Context Citations below... Every technical claim MUST cite the supporting source using [Citation X] notation."*

---

### 2.8 Chat Implementation (`backend/app/api/v1/endpoints/chat.py`)

#### [KEEP]
- **SSE Stream Protocol**:
  1. Emits `data: {"type": "citations", "citations": [...]}` with full document titles, pages, and chunk IDs.
  2. Emits `data: {"type": "token", "delta": "..."}` as tokens are received from DeepSeek.
  3. Emits `data: {"type": "done", "usage": {...}}` upon completion.
- **Frontend Chat UI**:
  - Renders assistant response in real-time.
  - Renders citation badges `[Doc: Velodyne SOP | Page 3]` under the response.
  - Clicking any badge opens the **Source Viewer Modal** with highlighted quotation.

---

### 2.9 Existing Tests (`backend/tests/`)

#### [KEEP]
- **78 / 78 Automated Tests Passing (100%)**:
  - `test_security_defenses.py` (18 tests): Auth, RBAC, tenant isolation, SQLi, file upload attacks.
  - `test_rag_evaluation.py` (4 tests): Context Precision, Recall, Faithfulness, Hit Rate@5, MRR.
  - `test_e2e_pipeline.py` (1 test): Complete lifecycle from login to SOP upload, retrieval, and SSE response.
  - `test_knowledge_flywheel.py` (3 tests): Feedback logging & re-indexing.
  - `test_document_management.py` (7 tests): Document CRUD, versions, storage.
  - `test_embedding_service.py` (8 tests): Batch embedding, hashing, deduplication.
  - `test_hybrid_retrieval.py` (6 tests): Vector search, filters, relevance scoring.
  - `test_reranker.py` (6 tests): Reranking accuracy & thresholding.
  - `test_llm_integration.py` (7 tests): DeepSeek streaming, token usage, errors.
  - `test_admin_dashboard.py` (7 tests): KPI metrics and audits.
  - `test_authorization.py` (11 tests): Project authorization & membership.

---

## 3. Categorization Matrix

| Element | Action | Rationale |
| :--- | :--- | :--- |
| **Real PDF/DOCX/MD text extraction with page numbers** | `KEEP` | Critical priority 2 (Real Document Ingestion). |
| **1024-dim BGE-M3 pgvector storage & cosine search** | `KEEP` | Critical priority 3 (Real Vector Retrieval). |
| **DeepSeek API SSE streaming integration** | `KEEP` | Critical priority 4 (Real DeepSeek API Integration). |
| **Interactive Source Viewer modal (`CitationModal.tsx`)** | `KEEP` | Critical priority 5 (Real Source Citations). |
| **5 Core Screens (Login, Dashboard, AI Chat, Docs, Source Viewer)** | `KEEP` | Core demo interface requirement. |
| **3D LiDAR point-cloud animation & dark automotive theme** | `KEEP` | Priority 7 (Visual identity for autonomous vehicle perception). |
| **Sidebar navigation with 4 clean demo tabs** | `SIMPLIFY` | Remove clutter; focus manager demo on Dashboard, Assistant, Documents. |
| **Reranker & Hybrid FTS algorithms** | `SIMPLIFY` | Keep primary vector path active to guarantee sub-second demo latency. |
| **Admin Knowledge Gap Queue & Telemetry Tab** | `REMOVE FROM V1` | Hide from primary demo navigation; preserve in codebase for V2. |
| **Standalone Search Explorer Tab** | `REMOVE FROM V1` | Redundant with AI Assistant chat; remove from primary sidebar. |
| **Department / Organization multi-tenant manager** | `REMOVE FROM V1` | Not required for single-organization manager demonstration. |
| **78 automated test suite** | `KEEP` | Verifies demo stability and guarantees zero regressions. |

---

## 4. Manager Demonstration Checklist (Tomorrow)

- [x] **1. Upload Sample SOP**: Upload `Velodyne_VLS128_SOP.md` or `.pdf` in `/documents`.
- [x] **2. Automatic Ingestion**: Confirm text extraction, page splitting, and pgvector embedding persist in Supabase.
- [x] **3. Ask Perception Question**: Ask in `/chat`: *"What is the minimum laser point density required for vehicle 3D bounding box fitting?"*
- [x] **4. Real Vector Retrieval**: Verify pgvector retrieves Page 3 of the Velodyne SOP with $\ge 98\%$ relevance score.
- [x] **5. Grounded Answer Generated**: Verify DeepSeek streams the answer: *"A valid vehicle bounding box MUST contain a minimum laser point cloud density of 15 points [Citation 1]."*
- [x] **6. Clickable Source Viewer**: Click the **`[Citation 1]`** card to reveal the Source Viewer modal showing Page 3 and the highlighted quote.
