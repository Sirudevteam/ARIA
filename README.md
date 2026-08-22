# LiDAR AI Assistant

A Retrieval-Augmented Generation (RAG) chatbot for LiDAR documentation and technical support.

## Project Structure

```
lidar-ai-assistant/
├── frontend/         # Next.js frontend application
├── backend/          # FastAPI backend with RAG pipeline
├── supabase/         # Database migrations and configuration
└── docs/             # Project documentation
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Supabase account

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials
3. Run `docker-compose up` to start all services

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python, LangChain
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: RAG pipeline with LLM integration
