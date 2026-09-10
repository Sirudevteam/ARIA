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

    # Ensure all tables exist in database
    try:
        from app.core.database import engine, async_session_factory
        from app.models import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[STARTUP] Database tables verified.")

        # Seed initial Roles, Organization, and Project if empty
        async with async_session_factory() as session:
            from sqlalchemy import select
            from app.models.role import Role, RoleScope
            from app.models.organization import Organization
            from app.models.department import Department
            from app.models.project import Project, ProjectStatus

            res_role = await session.execute(select(Role).limit(1))
            if not res_role.scalar_one_or_none():
                roles = [
                    Role(name="SUPER_ADMIN", scope=RoleScope.system, permissions=["*"], is_system=True, description="Full system access"),
                    Role(name="ADMIN", scope=RoleScope.organization, permissions=["org:admin", "project:all", "doc:all", "chat:all"], is_system=True, description="Organization Admin"),
                    Role(name="MANAGER", scope=RoleScope.organization, permissions=["project:manage", "doc:write", "chat:all"], is_system=True, description="Project Manager"),
                    Role(name="QC_LEAD", scope=RoleScope.project, permissions=["doc:review", "doc:read", "chat:all"], is_system=True, description="Quality Control Lead"),
                    Role(name="VALIDATOR", scope=RoleScope.project, permissions=["doc:read", "chat:all"], is_system=True, description="Dataset Validator"),
                    Role(name="ANNOTATOR", scope=RoleScope.project, permissions=["doc:read", "chat:all"], is_system=True, description="3D LiDAR Annotator"),
                    Role(name="VIEWER", scope=RoleScope.project, permissions=["doc:read", "chat:read"], is_system=True, description="Viewer"),
                ]
                session.add_all(roles)
                await session.commit()

            res_org = await session.execute(select(Organization).limit(1))
            if not res_org.scalar_one_or_none():
                org = Organization(
                    name="Autonomous Perception AI",
                    slug="autonomous-perception-ai",
                    settings={"theme": "dark", "retrieval_mode": "hybrid"},
                    is_active=True,
                )
                session.add(org)
                await session.commit()
                await session.refresh(org)

                dept = Department(
                    organization_id=org.id,
                    name="3D Perception & LiDAR",
                    description="Autonomous Driving LiDAR Perception and Annotation Group",
                )
                session.add(dept)

                proj = Project(
                    organization_id=org.id,
                    name="Urban 3D Perception Project",
                    slug="urban-3d-perception",
                    description="LiDAR annotation, cuboid labeling, and point cloud segmentation",
                    status=ProjectStatus.active,
                    settings={"confidentiality": "INTERNAL"},
                )
                session.add(proj)
                await session.commit()
                print("[STARTUP] Default Organization, Roles, and Project seeded.")

    except Exception as e:
        print(f"[STARTUP] Database initialization error: {e}")

    # Ensure Qdrant collection & hybrid vector indexes exist
    try:
        from app.services.vector_db.qdrant_service import qdrant_service
        await qdrant_service.ensure_collection()
        print("[STARTUP] Qdrant vector database initialized.")
    except Exception as e:
        print(f"[STARTUP] Qdrant initialization note: {e}")

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
