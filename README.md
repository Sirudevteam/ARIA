# ARIA — Annotation RAG Intelligence Assistant

> **Production-grade AI Knowledge Assistant for 3D LiDAR & Autonomous Vehicle Perception Workflows.**  
> Grounded question answering, real-time Server-Sent Events (SSE) streaming, verifiable multi-source citations, and hybrid semantic retrieval.

[![Backend](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Frontend](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev)
[![Database](https://img.shields.io/badge/PostgreSQL-16%2B%20%2F%20pgvector-336791?logo=postgresql)](https://github.com/pgvector/pgvector)
[![Vector Engine](https://img.shields.io/badge/Qdrant-Hybrid%20Vector-DC2626?logo=qdrant)](https://qdrant.tech)
[![Auth](https://img.shields.io/badge/Clerk-JWT%20%26%20RBAC-6C47FF?logo=clerk)](https://clerk.com)
[![LLM](https://img.shields.io/badge/DeepSeek-V3%20%2F%20R1-4F46E5)](https://deepseek.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🌟 Key Highlights & Capabilities

- 🎯 **Grounded, Anti-Hallucination RAG**: Strict context-bounded answers citing SOP guidelines with page numbers, document titles, and similarity scores.
- ⚡ **Real-Time Streaming**: Server-Sent Events (SSE) token delivery with live status indicators and expandable reasoning traces.
- 🔍 **Hybrid Retrieval Engine**: Dense semantic embeddings (BGE-M3 1024d) + BM25 keyword matching fused via Reciprocal Rank Fusion (RRF) and BGE Cross-Encoder reranking.
- 🛡️ **Zero-Trust RBAC**: 7-tier enterprise role hierarchy (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `QC_LEAD`, `VALIDATOR`, `ANNOTATOR`, `VIEWER`) backed by Clerk JWT validation and PostgreSQL scoping.
- 📁 **Enterprise Knowledge Management**: Ingestion of multi-page PDF, DOCX, Markdown, and TXT files with atomic versioning, SHA-256 integrity checksums, and Cloudflare R2 / S3 storage.
- 📊 **Real Admin & Analytics Portal**: Live database KPIs, active project metrics, and real-time knowledge gap queue resolved via direct SOP uploads.
- 🎨 **Modern Automotive UI**: Next.js 16 App Router with Tailwind CSS v4, Lucide icons, responsive cross-breakpoint layouts, and high-contrast accessibility.

---

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph Client["Frontend Client (Next.js 16 + React 19)"]
        UI["App Router Pages\n(/chat · /documents · /admin · /dashboard)"]
        AUTH_UI["Clerk Auth Provider & Session Client"]
    end

    subgraph Backend["Backend API (FastAPI 0.115)"]
        ROUTER["API Router (/api/v1)"]
        AUTH_MD["Security & JWT / JWKS Validator"]
        RBAC["7-Tier Role Authorization"]
        
        subgraph Pipeline["Hybrid RAG Pipeline Engine"]
            EMB["BGE-M3 Embedding Service (1024d)"]
            HYBRID["Hybrid Search (Vector + Full-Text FTS + RRF)"]
            RERANK["BGE Cross-Encoder Reranker"]
            LLM["DeepSeek-V3 LLM Streaming (SSE)"]
        end

        DOC_MGR["Document Ingestion & Chunking Manager"]
    end

    subgraph Data["Persistence & Vector Layer"]
        PG["PostgreSQL (Railway / Neon / Supabase)\nRelations, Roles, Projects, Audit Logs, Documents"]
        QDRANT["Qdrant Vector DB / pgvector\n1024-dim dense vectors & hybrid payload"]
        STORAGE["Cloudflare R2 / S3 / Local Storage\nSource documents & version blobs"]
    end

    UI -->|"REST & SSE (Proxied via /api/v1)"| ROUTER
    AUTH_UI -->|"Clerk Session Token"| AUTH_MD
    ROUTER --> AUTH_MD --> RBAC
    ROUTER --> DOC_MGR --> STORAGE
    DOC_MGR --> EMB --> QDRANT
    ROUTER --> Pipeline
    Pipeline --> QDRANT
    Pipeline --> PG
    Pipeline --> LLM
```

---

## 💻 Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend Framework** | Next.js 16.3.2 (App Router) | React 19, Turbopack, Standalone Docker output |
| **Styling & UI** | Tailwind CSS v4, shadcn/ui | Lucide icons, glassmorphism, responsive grid system |
| **Authentication** | Clerk (`@clerk/nextjs` v7) | JWKS RS256 token verification, multi-session support |
| **Backend Engine** | FastAPI 0.115.5, Python 3.11+ | Async SQLAlchemy 2.0, Pydantic v2, Uvicorn |
| **Relational Database** | PostgreSQL 16+ | Psycopg3 async driver, relational schema, auto-migrations |
| **Vector Storage** | Qdrant / pgvector | 1024-dim dense vectors with cosine similarity |
| **Embedding Model** | BAAI/bge-m3 (1024 dimensions) | Multi-lingual semantic dense representation |
| **Reranker** | BAAI/bge-reranker-v2-m3 | 2-stage cross-encoder relevance reranking |
| **LLM Inference** | DeepSeek-V3 (`deepseek-chat`) | High-speed grounded generation with reasoning stream |
| **Object Storage** | Cloudflare R2 / AWS S3 / Local | Document versions with SHA-256 validation |

---

## 🚀 Quick Start — Local Development

### Prerequisites

- [Node.js 20+](https://nodejs.org) and npm
- [Python 3.11+](https://python.org)
- [PostgreSQL 16+](https://www.postgresql.org) or Docker Desktop
- [DeepSeek API Key](https://platform.deepseek.com)
- [Clerk Account](https://clerk.com) for authentication

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit `backend/.env`:
```ini
APP_NAME=ARIA
APP_ENV=development
DEBUG=True
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/aria_db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Clerk Authentication
AUTH_PROVIDER=clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# DeepSeek & AI Providers
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat

# Vector DB & Storage
VECTOR_DB_BACKEND=qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
STORAGE_BACKEND=local
```

Run the backend server:
```bash
python run.py
# Or with uvicorn:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### 2. Frontend Setup

```bash
cd frontend

# Install packages
npm install

# Configure environment
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view ARIA.

---

### 3. Docker Compose (Full Stack)

To run the entire system with Docker Compose:

```bash
docker compose up --build -d
```

| Service | Address | Description |
|---|---|---|
| **Frontend** | `http://localhost:3000` | ARIA Web Application |
| **Backend API** | `http://localhost:8000` | FastAPI service |
| **Swagger Docs** | `http://localhost:8000/docs` | Interactive OpenAPI Explorer |
| **Health Probe** | `http://localhost:8000/api/v1/health` | Readiness & DB verification |

---

## 📡 REST API Reference

All backend routes are versioned under `/api/v1`.

### Core Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/v1/health` | System health check and database status | No |
| `GET` | `/api/v1/auth/me` | Current authenticated user profile and roles | Yes (Bearer) |
| `GET` | `/api/v1/projects` | List all available annotation projects | Yes |
| `POST` | `/api/v1/projects` | Create a new annotation project | Yes (Manager+) |
| `GET` | `/api/v1/departments` | List organizational departments | Yes |
| `GET` | `/api/v1/documents` | List SOP documents with filtering | Yes |
| `POST` | `/api/v1/projects/{id}/documents/upload` | Upload SOP document (PDF, DOCX, MD, TXT) | Yes (Manager+) |
| `GET` | `/api/v1/documents/{id}/download` | Download source document file | Yes |
| `DELETE` | `/api/v1/documents/{id}` | Remove document and all vector chunks | Yes (Admin) |
| `POST` | `/api/v1/chat/completions` | Non-streaming grounded RAG answer | Yes |
| `POST` | `/api/v1/chat/stream` | Real-time SSE streaming RAG answer with citations | Yes |
| `POST` | `/api/v1/chat/feedback` | Thumbs up / down feedback submission | Yes |
| `POST` | `/api/v1/search/retrieve` | Hybrid vector + keyword search test | Yes |
| `GET` | `/api/v1/admin/kpis` | Real-time database KPI counters | Yes (Admin) |
| `GET` | `/api/v1/admin/knowledge-gaps` | Downvoted questions awaiting SOP documentation | Yes (Admin) |
| `POST` | `/api/v1/admin/knowledge-gaps/{id}/resolve` | Resolve gap with new uploaded SOP | Yes (Admin) |

---

## 🌐 Production Deployment (Railway)

ARIA is fully pre-configured for one-click deployment on [Railway](https://railway.app):

1. **Database**: Provision a Railway PostgreSQL service with pgvector support.
2. **Backend Service**:
   - Source directory: `backend/`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Set environment variables: `DATABASE_URL`, `DEEPSEEK_API_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CORS_ORIGINS`.
3. **Frontend Service**:
   - Source directory: `frontend/`
   - Buildpack / Dockerfile: Uses `frontend/Dockerfile` (Standalone output)
   - Set environment variables: `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

---

## 🧪 Testing & Verification

Run the comprehensive test suite to verify all subsystems:

```bash
# Backend pytest suite (RAG pipeline, auth, ingestion, search)
cd backend
pytest tests/ -v

# Frontend type checking and linting
cd frontend
npx tsc --noEmit
npm run lint
```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
