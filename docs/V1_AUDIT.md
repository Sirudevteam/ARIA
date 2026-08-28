# ARIA V1 Audit — Current Implementation Analysis
**Date:** 2026-08-28  
**Branch:** main (commit 392b220)  
**Purpose:** Full audit of existing ARIA codebase for manager demonstration readiness.  
**Auditor:** Antigravity AI  

---

## Project Structure

```
RAG chatbot/
├── backend/              FastAPI Python backend
│   ├── app/
│   │   ├── api/v1/endpoints/   11 endpoint modules
│   │   ├── core/               config.py, settings
│   │   ├── models/             12 SQLAlchemy ORM models
│   │   ├── schemas/            Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── document/       ingestion.py, manager.py, storage.py
│   │   │   ├── embedding/      service.py, factory, providers
│   │   │   ├── llm/            base.py, factory, providers (DeepSeek)
│   │   │   └── rag/            generator.py, retrieval.py, prompt_composer.py, reranker/
│   │   └── main.py
│   └── tests/                 12 test modules (81 tests total)
├── frontend/             Next.js 16 TypeScript frontend
│   ├── app/
│   │   ├── (auth)/login/       Login page
│   │   └── (dashboard)/        Protected routes: /dashboard, /chat, /documents, /profile, /admin, /search
│   ├── components/
│   │   ├── chat/               CitationModal, MarkdownRenderer
│   │   ├── layout/             Sidebar, Header
│   │   └── ui/                 LidarBackground, VehicleWireframe + shadcn/ui components
│   └── lib/services/           chat.ts, documents.ts, search.ts, admin.ts
├── supabase/             Schema SQL, migrations, seed data
└── docs/                 V1_AUDIT.md (this file), enterprise docs
```

---

## 1. KEEP
*Components that work correctly and should remain unchanged for V1.*

### Backend
| Component | File | Why Keep |
|---|---|---|
| FastAPI app factory | `backend/app/main.py` | Clean lifespan, CORS, router composition |
| API router | `api/v1/router.py` | All 10 endpoint groups registered correctly |
| **Chat streaming endpoint** | `endpoints/chat.py` | `/chat/stream` SSE works end-to-end. `/chat/completions` non-streaming also works. Feedback endpoint exists. |
| **RAG generator** | `services/rag/generator.py` | Full pipeline: retrieve → rerank → compose → stream. Honest refusal when no citations found. `min_relevance_threshold=0.15` |
| **Hybrid retrieval engine** | `services/rag/retrieval.py` | pgvector cosine search + in-process BM25-style keyword scoring + Reciprocal Rank Fusion. Auth-aware project scoping. |
| **Prompt composer** | `services/rag/prompt_composer.py` | Numbered `[Citation X]` grounded system prompt. Conversation history injected (last 6 turns). No hallucination instructions. |
| **Document ingestion** | `services/document/ingestion.py` | PDF (PyPDF), DOCX (python-docx), MD, TXT extraction. Page-level metadata preserved. 1200-char sliding window chunks with 150-char overlap. |
| **Embedding service** | `services/embedding/service.py` | BGE-M3 1024d vectors. SHA-256 deduplication. Batch size 32. Re-embed on demand. |
| **Reranker service** | `services/rag/reranker/service.py` | BGE-reranker-v2-m3 cross-encoder. Pluggable factory pattern. |
| **Document manager** | `services/document/manager.py` | Create/upload, multi-versioning, status transitions, list/filter/delete. |
| Auth endpoint | `endpoints/auth.py` | `/auth/me` profile + role + project access resolver. |
| Documents endpoint | `endpoints/documents.py` | Upload, list, version, download, archive, delete. Triggers `process_and_embed_document` on upload. |
| **Settings** | `core/config.py` | Pydantic Settings. Reads `.env`. All providers (BGE, DeepSeek, reranker) configurable without code changes. |
| Supabase schema | `supabase/complete_supabase_setup.sql` | `pgvector(1024)`, HNSW index, `tsvector` GIN index, all FK relationships, enums correct. |
| **V1 RAG pipeline test** | `tests/test_v1_rag_pipeline.py` | 14-point comprehensive pipeline test. All 81 tests passing. |

### Frontend
| Component | File | Why Keep |
|---|---|---|
| **Chat page (logic layer)** | `app/(dashboard)/chat/page.tsx` | Full SSE streaming, session management (localStorage), citation chip click, regenerate, feedback modal, stop generation, project filter, hyperparameter controls. All connects to real backend. |
| **Documents page** | `app/(dashboard)/documents/page.tsx` | Upload, filter, table, version drawer, download. Connects to real `documentsService`. |
| **chat.ts service** | `lib/services/chat.ts` | Correct SSE parsing (`citations`, `delta`, `done` event types). `streamChatCompletion`, `getChatCompletion`, `submitFeedback`. |
| **documents.ts service** | `lib/services/documents.ts` | All document CRUD API calls. |
| **CitationModal** | `components/chat/CitationModal.tsx` | Frosted-glass source viewer. Shows document title, page, relevance score bar, content excerpt, copy button. |
| **MarkdownRenderer** | `components/chat/MarkdownRenderer.tsx` | Renders markdown in chat responses with syntax highlighting. |
| **Sidebar** | `components/layout/Sidebar.tsx` | Dark automotive nav, 4 routes, cyan active state, RAG status chip. |
| **Header** | `components/layout/Header.tsx` | Minimal top bar, breadcrumb, role badge, API status. |
| Dark theme CSS | `app/globals.css` | ARIA dark tokens forced globally. `scan-pulse`, `aria-nav-active` utilities. |
| **LidarBackground** | `components/ui/LidarBackground.tsx` | SVG dot-grid point cloud background. |
| **VehicleWireframe** | `components/ui/VehicleWireframe.tsx` | Top-down vehicle SVG with scan rings + annotation box. |
| **Dashboard page** | `app/(dashboard)/dashboard/page.tsx` | System status metrics, vehicle hero, quick actions, architecture trace, rotating query tips. |
| **Login page** | `app/(auth)/login/page.tsx` | Two-panel dark layout, vehicle wireframe, demo quick-login buttons for 7 roles. |

---

## 2. SIMPLIFY
*Components that work but are over-engineered for V1 demo purposes.*

| Component | Current State | V1 Simplification |
|---|---|---|
| `api/v1/endpoints/admin.py` (10KB) | Full admin CRUD for users, roles, org settings, knowledge gap queue | Show only Knowledge Gap Queue in demo — hide user/role management UI |
| `services/document/manager.py` (474 lines) | Full multi-version lifecycle, archiving, soft-delete, department filtering | V1 only needs: upload → ready, list, delete. Versioning UI can be simplified |
| `api/v1/endpoints/projects.py` (9KB) | Full project CRUD + member management | Only need project list for the project filter dropdown in chat |
| `app/(dashboard)/search/page.tsx` | Standalone semantic search page | Hide from sidebar for demo — search is already embedded in chat |
| Conversation history (chat.ts) | Last 6 turns context injection | Keep working, but limit to last 2 turns for faster demo response time |
| `config.py RERANKER_MIN_THRESHOLD` | 0.25 in config, overridden to 0.15 in code | Align — set both to 0.15 for demo stability |

---

## 3. FIX
*Known bugs or mismatches that need to be addressed before demo.*

| Issue | Location | Description |
|---|---|---|
| ⚠️ `main.py` description | `app/main.py` line 43 | Says `"RAG engine and LLM integrations are not yet implemented."` — this is wrong, the RAG pipeline is fully implemented. |
| ⚠️ Feedback not persisted | `endpoints/chat.py` line 112-118 | `submit_chat_feedback` returns success but does NOT actually write to the `feedback` table. In-memory only. |
| ⚠️ `RERANKER_MIN_THRESHOLD` mismatch | `config.py` (0.25) vs `generator.py` (0.15 hardcoded default) | Config value is unused — generator hardcodes 0.15. Should be one source of truth. |
| ⚠️ SQLite test DB files in root | `test_llm_*.db` (5 files at root) | Leftover from pytest isolation. Should be in `tests/` or `.gitignore`d. Not a runtime bug. |
| ⚠️ `joined_at` field on `ProjectMember` | `schemas/auth.py` | `ProjectAccessInfo` uses `joined_at` which maps to `created_at` on `ProjectMember` — verify column exists in DB. |
| ⚠️ `project_members.joined_at` | `supabase/complete_supabase_setup.sql` line 119 | Schema only has `created_at` on project_members, not `joined_at`. Model/schema mismatch may cause runtime errors. |
| ⚠️ `storage.py` local disk paths | `services/document/storage.py` | Stores files in `storage/` directory locally. Fine for demo, but path must exist and be writable. |

---

## 4. REMOVE FROM V1
*Features that exist but should be hidden/disabled for the manager demo to keep the demo clean.*

| Feature | Location | Reason to Remove from Demo |
|---|---|---|
| Admin panel route `/admin` | `app/(dashboard)/admin/` | Enterprise admin UI is V2. Confuses demo scope. |
| Search page `/search` | `app/(dashboard)/search/page.tsx` | Redundant with chat. Adds clutter to demo nav. |
| `AutomotiveLidarAnimation` component | `components/landing/` | Old landing page animation component — no longer used since page.tsx was replaced. |
| Old public landing page (original) | `app/page.tsx` (original) | Replaced with auth-redirect. Old 175-line landing page no longer needed. |
| `docker-compose.yml` | root | Useful for V2 deploy but irrelevant to demo. Not shown to manager. |
| Knowledge Flywheel endpoints | `endpoints/admin.py` | V2 feature for automated SOP reingestion. Too complex for V1 demo. |
| `services/rag/evaluation.py` | `services/rag/evaluation.py` | RAG evaluation scoring module. V2 analytics feature. |
| Department management | `endpoints/departments.py` | Not needed for demo. |

---

## 5. MISSING
*Features that are explicitly needed for V1 demo but do not currently exist.*

| Missing Feature | Priority | Details |
|---|---|---|
| 🔴 **Feedback persistence** | HIGH | `submit_chat_feedback` returns 201 but does not write to DB. The `feedback` table exists in schema but is not used. Fix: add INSERT to feedback table. |
| 🟡 **Conversation persistence** | MEDIUM | Chat sessions stored in browser `localStorage` only. Cleared on browser reset. The `conversations` and `messages` tables exist in DB but are never written to from the API. Acceptable for demo. |
| 🟡 **Processing status indicator** | MEDIUM | After document upload, there is no real-time status webhook to the frontend. Frontend polls via document list fetch. Add a visible "PROCESSING → READY" state indicator on Documents page. |
| 🟢 **ARIA logo** | LOW | `public/aria-logo.jpg` is referenced in Sidebar and Login. Confirm the file exists in `/frontend/public/`. |
| 🟢 **Demo `.env` documentation** | LOW | No `backend/.env.example` file exists. Should document required env vars for DEEPSEEK_API_KEY, SUPABASE_URL etc. for demo setup. |
| 🟢 **Error boundary in chat** | LOW | No React error boundary wrapping the chat page. If backend returns 500 during stream, the UI may go blank silently. |

---

## 6. RISKS
*Technical and demo risks that could break the demonstration.*

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| 🔴 **BGE-M3 model download** | CRITICAL | HIGH | BGE-M3 (`BAAI/bge-m3`, ~2.2GB) and BGE-reranker-v2-m3 must be downloaded locally on the demo machine. If not cached, the first query will fail or be very slow. Run `embed_query("test")` once before demo to warm cache. |
| 🔴 **DeepSeek API key not set** | CRITICAL | HIGH | If `DEEPSEEK_API_KEY` is missing or expired in `.env`, all chat completions will 500. Verify key is valid and has quota before demo. |
| 🔴 **No documents uploaded** | CRITICAL | HIGH | If no documents are in the knowledge base, every question triggers the honest refusal: *"no relevant information was found."* Upload at least 1–2 real annotation SOPs before demo. |
| 🟡 **pgvector HNSW index** | HIGH | MEDIUM | If the `idx_chunks_embedding` HNSW index is not created on the Supabase instance, vector similarity search degrades to sequential scan (very slow at scale). Verify with `\di` in psql. |
| 🟡 **Cold start latency** | MEDIUM | HIGH | First request after server start is slow (~3–8s) because BGE-M3 loads into GPU/CPU memory. Warm up by sending one query before manager enters the room. |
| 🟡 **SSE connection drop** | MEDIUM | LOW | Long streaming responses (>60s) may be cut by proxy timeouts. Set `LLM_TIMEOUT_SECONDS=120` in `.env` and keep responses concise during demo. |
| 🟡 **CORS on production URL** | MEDIUM | LOW | `CORS_ORIGINS` defaults to `localhost:3000`. If demo is hosted on a different port or IP, add the URL to `.env`. |
| 🟢 **`project_members.joined_at` mismatch** | LOW | MEDIUM | Schema uses `created_at` but code references `joined_at`. May cause a 500 on `/auth/me` for non-admin users with project memberships. Use SUPER_ADMIN demo account which takes the admin code path. |
| 🟢 **Browser localStorage session loss** | LOW | LOW | Chat history lives in localStorage. Incognito or cleared browser loses all sessions. Use a regular browser window for demo. |
| 🟢 **Windows asyncio policy** | LOW | LOW | `main.py` already sets `WindowsSelectorEventLoopPolicy` for Win32. No action needed. |

---

## Summary

**Current State: DEMO-READY with 3 pre-flight actions required.**

| Category | Count | Status |
|---|---|---|
| KEEP (working) | 28 components | ✅ |
| SIMPLIFY | 6 items | 🔧 Optional |
| FIX (bugs) | 6 items | ⚠️ 2 critical |
| REMOVE FROM V1 | 8 items | 🗑️ Optional cleanup |
| MISSING | 5 items | 🔴 1 critical |
| RISKS | 9 risks | 🔴 3 critical |

### Pre-Demo Checklist
- [ ] Verify `DEEPSEEK_API_KEY` is set and valid in `backend/.env`
- [ ] Upload 2–3 real annotation SOP documents through the UI
- [ ] Warm up model: send one test query from the chat page and confirm it returns an answer with citations
- [ ] Verify `public/aria-logo.jpg` exists in frontend
- [ ] Fix `main.py` description string (1 line change)
