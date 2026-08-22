"""
API v1 router — aggregates all v1 endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, departments, documents, health, projects, users

router = APIRouter(prefix="/api/v1")

router.include_router(health.router)
router.include_router(auth.router)
router.include_router(users.router)
router.include_router(projects.router)
router.include_router(departments.router)
router.include_router(documents.router)
