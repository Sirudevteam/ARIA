"""
Health check endpoint — GET /api/v1/health
"""

import asyncio
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
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
async def health_check() -> HealthResponse:
    """
    Verifies:
    - Application is running
    - Database connection is alive (with 2-second timeout)
    """
    db_status = "unreachable"
    try:
        async def check_db():
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))

        await asyncio.wait_for(check_db(), timeout=5.0)
        db_status = "connected"
    except Exception as e:
        print(f"[HEALTH] Database check failed: {type(e)} {e}")
        db_status = "unreachable"

    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        database=db_status,
    )
