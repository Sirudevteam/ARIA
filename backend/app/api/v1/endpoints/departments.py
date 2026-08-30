"""
Department endpoints for organizational unit assignment.
"""

from typing import List
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import DBSession, get_current_user
from app.models.department import Department
from app.models.user import User
from app.schemas.document import DepartmentResponse

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get(
    "",
    response_model=List[DepartmentResponse],
    summary="List organization departments",
    description="Returns departments belonging to the user's organization.",
)
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[DepartmentResponse]:
    """Fetch departments within the tenant organization."""
    stmt = (
        select(Department)
        .where(Department.organization_id == current_user.organization_id)
        .order_by(Department.name.asc())
    )
    res = await db.execute(stmt)
    deps = res.scalars().all()

    return [
        DepartmentResponse(
            id=d.id,
            organization_id=d.organization_id,
            name=d.name,
            description=d.description,
        )
        for d in deps
    ]
