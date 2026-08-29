import asyncio
import sys
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router as v1_router
from app.core.config import get_settings

settings = get_settings()


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print(f"[STARTUP] {settings.APP_NAME} v{settings.APP_VERSION} starting...")
    print(f"   Environment : {settings.APP_ENV}")
    print(f"   Debug mode  : {settings.DEBUG}")
    yield
    # Shutdown
    print(f"[SHUTDOWN] {settings.APP_NAME} shutting down...")


# ── App factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "ARIA — Annotation RAG Intelligence Assistant. "
            "Production API for 3D LiDAR annotation knowledge retrieval. "
            "Fully implemented RAG pipeline: BGE-M3 embeddings → pgvector retrieval → "
            "BGE cross-encoder reranking → grounded DeepSeek-V3 generation with verified citations."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.DEBUG else settings.cors_origins_list,
        allow_credentials=True if not (settings.DEBUG and "*" in settings.cors_origins_list) else False,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global Exception Handler ──────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "type": type(exc).__name__},
        )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(v1_router)

    # ── Root redirect ─────────────────────────────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def root():
        return JSONResponse(
            {"message": f"{settings.APP_NAME} API", "docs": "/docs", "health": "/api/v1/health"}
        )

    return app


app = create_app()
