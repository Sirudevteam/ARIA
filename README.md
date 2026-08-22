# ARIA — Annotation RAG Intelligence Assistant

> Production-grade AI knowledge assistant for 3D LiDAR annotation workflows.

[![Backend](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com)
[![Frontend](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Database](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://docs.docker.com/compose)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.11, Pydantic v2, SQLAlchemy 2 async |
| Database | PostgreSQL 16 + pgvector (via Supabase or local Docker) |
| Infrastructure | Docker Compose |

---

## Prerequisites

- [Node.js 18+](https://nodejs.org) and npm
- [Python 3.11+](https://python.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Git

---

## Quick Start — Local Development

### 1. Clone and configure environment

```bash
git clone https://github.com/Deenachandran/RAG-chatbot.git
cd RAG-chatbot
cp .env.example .env
# Edit .env with your values
```

### 2. Run with Docker Compose (recommended)

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Health Check | http://localhost:8000/api/v1/health |

---

### 3. Run services manually (without Docker)

#### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

#### Database (local Postgres via Docker)

```bash
docker run -d \
  --name lidar_postgres \
  -e POSTGRES_USER=lidar_user \
  -e POSTGRES_PASSWORD=lidar_password \
  -e POSTGRES_DB=lidar_db \
  -p 5432:5432 \
  postgres:16-alpine
```

---

## Project Structure

```
lidar-ai-assistant/
├── frontend/              # Next.js App Router application
│   ├── app/               # Pages & layouts
│   ├── components/        # Reusable components
│   │   └── layout/        # Sidebar, Header
│   ├── lib/               # API client (lib/api.ts)
│   ├── services/          # Service layer
│   └── types/             # TypeScript interfaces
│
├── backend/               # FastAPI application
│   ├── app/
│   │   ├── api/v1/        # Versioned routes
│   │   ├── core/          # Config, database
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   ├── rag/           # RAG pipeline (future)
│   │   ├── llm/           # LLM integration (future)
│   │   └── documents/     # Document ingestion (future)
│   └── migrations/        # Alembic DB migrations
│
├── supabase/              # Database
│   ├── migrations/        # SQL migrations
│   └── config.toml        # Supabase CLI config
│
└── docs/                  # Architecture & API docs
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | API info |
| `/api/v1/health` | GET | Health + DB check |
| `/docs` | GET | Swagger UI |
| `/redoc` | GET | ReDoc UI |

---

## Roadmap

- [x] Project foundation & folder structure
- [x] FastAPI backend with health check
- [x] Next.js frontend scaffold
- [x] PostgreSQL schema (pgvector ready)
- [x] Docker Compose with all services
- [ ] Document ingestion pipeline
- [ ] RAG engine (LangChain + pgvector)
- [ ] LLM integration (DeepSeek / OpenAI)
- [ ] Authentication (Supabase Auth)
- [ ] Chat interface
- [ ] Production deployment

---

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Push and open a pull request

---

## License

MIT © Deenachandran
