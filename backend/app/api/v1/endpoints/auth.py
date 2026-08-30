"""
Authentication and Profile endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import CurrentUser, DBSession, get_current_user
from app.models.project import Project, ProjectMember
from app.models.team import Team
from app.models.user import User
from app.schemas.auth import (
    OrganizationInfo,
    ProjectAccessInfo,
    RoleInfo,
    TeamInfo,
    UpdateProfileRequest,
    UserProfileResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current user profile",
    description="Returns authenticated user profile, organization info, assigned role, teams, and accessible projects.",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Fetch current user's profile with fully resolved authorization context."""

    # 1. Fetch user's team memberships
    teams = []
    if current_user.team_id:
        stmt_teams = select(Team).where(Team.id == current_user.team_id)
        res_teams = await db.execute(stmt_teams)
        t_val = res_teams.scalar_one_or_none()
        if t_val:
            teams = [t_val]

    # 2. Fetch user's project access
    user_role_name = current_user.role.name.upper() if current_user.role else "VIEWER"

    if user_role_name in ("SUPER_ADMIN", "ADMIN"):
        # Org Admins see all projects in the organization
        stmt_projs = select(Project).where(Project.organization_id == current_user.organization_id)
        res_projs = await db.execute(stmt_projs)
        all_projs = res_projs.scalars().all()

        projects_access = [
            ProjectAccessInfo(
                project_id=p.id,
                project_name=p.name,
                project_role=user_role_name,
                status=p.status.value if hasattr(p.status, "value") else str(p.status),
                joined_at=p.created_at,
            )
            for p in all_projs
        ]
    else:
        # Standard members see only explicitly joined projects
        stmt_members = (
            select(ProjectMember, Project)
            .join(Project, Project.id == ProjectMember.project_id)
            .where(ProjectMember.user_id == current_user.id)
            .options(selectinload(ProjectMember.role))
        )
        res_members = await db.execute(stmt_members)
        member_records = res_members.all()

        projects_access = [
            ProjectAccessInfo(
                project_id=proj.id,
                project_name=proj.name,
                project_role=member.role.name if member.role else "VIEWER",
                status=proj.status.value if hasattr(proj.status, "value") else str(proj.status),
                joined_at=member.joined_at,
            )
            for member, proj in member_records
        ]

    # 3. Calculate effective permissions
    permissions = list(current_user.role.permissions) if (current_user.role and current_user.role.permissions) else []
    if user_role_name == "SUPER_ADMIN":
        permissions = ["*"]

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        status=current_user.status.value if hasattr(current_user.status, "value") else str(current_user.status),
        last_seen_at=current_user.last_seen_at,
        organization=OrganizationInfo.model_validate(current_user.organization),
        role=RoleInfo.model_validate(current_user.role) if current_user.role else None,
        teams=[TeamInfo.model_validate(t) for t in teams],
        projects=projects_access,
        effective_permissions=permissions,
    )


@router.patch(
    "/profile",
    response_model=UserProfileResponse,
    summary="Update current user profile",
    description="Allows updating display name and avatar URL.",
)
async def update_my_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Update profile attributes for the authenticated user."""
    if body.name is not None:
        current_user.name = body.name.strip()
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url.strip()

    await db.commit()
    await db.refresh(current_user)

    return await get_my_profile(current_user=current_user, db=db)
