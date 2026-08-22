"""
User management endpoints (RBAC protected).
"""

from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession, get_current_user, require_roles
from app.models.user import User
from app.schemas.auth import OrganizationInfo, RoleInfo, UserProfileResponse

router = APIRouter(prefix="/users", tags=["Users Management"])


@router.get(
    "",
    response_model=List[UserProfileResponse],
    summary="List organization users",
    description="Returns all users in the current organization. Requires ADMIN, SUPER_ADMIN, or MANAGER role.",
    dependencies=[Depends(require_roles("ADMIN", "SUPER_ADMIN", "MANAGER"))],
)
async def list_users(
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> List[UserProfileResponse]:
    """List users within the same tenant organization."""
    user_role = current_user.role.name.upper() if current_user.role else "VIEWER"

    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization),
    )

    if user_role != "SUPER_ADMIN":
        stmt = stmt.where(User.organization_id == current_user.organization_id)

    stmt = stmt.order_by(User.name.asc())
    result = await db.execute(stmt)
    users = result.scalars().all()

    return [
        UserProfileResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            avatar_url=u.avatar_url,
            status=u.status.value if hasattr(u.status, "value") else str(u.status),
            last_seen_at=u.last_seen_at,
            organization=OrganizationInfo.model_validate(u.organization),
            role=RoleInfo.model_validate(u.role) if u.role else None,
            teams=[],
            projects=[],
            effective_permissions=list(u.role.permissions) if (u.role and u.role.permissions) else [],
        )
        for u in users
    ]


@router.get(
    "/{user_id}",
    response_model=UserProfileResponse,
    summary="Get user by ID",
    dependencies=[Depends(require_roles("ADMIN", "SUPER_ADMIN", "MANAGER"))],
)
async def get_user_by_id(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: DBSession = None,
) -> UserProfileResponse:
    """Fetch single user details in the same organization."""
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.role),
            selectinload(User.organization),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    user_role = current_user.role.name.upper() if current_user.role else "VIEWER"
    if user_role != "SUPER_ADMIN" and user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    return UserProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        status=user.status.value if hasattr(user.status, "value") else str(user.status),
        last_seen_at=user.last_seen_at,
        organization=OrganizationInfo.model_validate(user.organization),
        role=RoleInfo.model_validate(user.role) if user.role else None,
        teams=[],
        projects=[],
        effective_permissions=list(user.role.permissions) if (user.role and user.role.permissions) else [],
    )
