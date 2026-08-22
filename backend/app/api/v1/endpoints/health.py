"""
Health check endpoint — GET /api/v1/health
"""

from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DBSession
from app.core.config import get_settings
from app.schemas.common import HealthResponse

router = APIRouter()
settings = get_settings()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Returns application status and database connectivity.",
    tags=["Health"],
)
async def health_check(db: DBSession) -> HealthResponse:
    """
    Verifies:
    - Application is running
    - Database connection is alive
    """
    db_status = "unreachable"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "unreachable"

    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        database=db_status,
    )
