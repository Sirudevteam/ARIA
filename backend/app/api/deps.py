"""
FastAPI dependencies for database sessions and open-access user context.
Authentication removed for open-source mode.
"""

from collections.abc import AsyncGenerator
from typing import Annotated, Optional, Tuple
import uuid

from fastapi import Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.document import Document
from app.models.organization import Organization
from app.models.project import Project, ProjectMember
from app.models.role import Role
from app.models.team import Team
from app.models.user import User, UserStatus

# ── Database Dependency Shortcut ───────────────────────────────────────────────
DBSession = Annotated[AsyncSession, Depends(get_db)]

# Default open-source user constants
DEFAULT_USER_ID = uuid.UUID("c0000000-0000-0000-0000-000000000001")
DEFAULT_USER_EMAIL = "admin@aria.local"
DEFAULT_USER_NAME = "ARIA User"


# =============================================================================
# 1. USER CONTEXT: get_current_user (no authentication)
# =============================================================================
async def get_current_user(
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Returns the default open-source user. Auto-provisions on first request.
    No authentication token is required.
    """
    stmt = (
        select(User)
        .where(User.id == DEFAULT_USER_ID)
        .options(
            selectinload(User.role),
            selectinload(User.organization),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Auto-provision the default user
        org_stmt = select(Organization).limit(1)
        org_res = await db.execute(org_stmt)
        if not org:
            org = Organization(
                id=uuid.UUID("a0000000-0000-0000-0000-000000000001"),
                name="ARIA Open Source",
                slug="aria-open-source",
                settings={},
                is_active=True,
            )
            db.add(org)
            await db.flush()

        role_stmt = select(Role).where(Role.name.in_(["SUPER_ADMIN", "ADMIN"])).limit(1)
        role_res = await db.execute(role_stmt)
        role = role_res.scalar_one_or_none()
        if not role:
            from app.models.role import RoleScope
            role = Role(
                id=uuid.UUID("b0000000-0000-0000-0000-000000000001"),
                name="SUPER_ADMIN",
                scope=RoleScope.system,
                permissions=["*"],
                is_system=True,
                description="Default Super Admin Role",
            )
            db.add(role)
            await db.flush()

        user = User(
            id=DEFAULT_USER_ID,
            email=DEFAULT_USER_EMAIL,
            name=DEFAULT_USER_NAME,
            organization_id=org.id,
            role_id=role.id,
            status=UserStatus.active,
        )
        db.add(user)
        await db.commit()

        # Re-fetch with relationships
        stmt = (
            select(User)
            .where(User.id == user.id)
            .options(
                selectinload(User.role),
                selectinload(User.organization),
            )
        )
        res = await db.execute(stmt)
        user = res.scalar_one()

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# =============================================================================
# 2. PROJECT ACCESS (simplified — no org isolation)
# =============================================================================
async def get_project_and_membership(
    project_id: uuid.UUID = Path(..., description="Target project UUID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tuple[Project, Optional[ProjectMember]]:
    """
    Verifies that the project exists and returns it with optional membership.
    No org-tenant isolation in open-source mode.
    """
    stmt_proj = (
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.organization))
    )
    res_proj = await db.execute(stmt_proj)
    project = res_proj.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found.",
        )

    # Fetch membership (optional)
    stmt_member = (
        select(ProjectMember)
        .where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == current_user.id,
        )
        .options(selectinload(ProjectMember.role))
    )
    res_member = await db.execute(stmt_member)
    member = res_member.scalar_one_or_none()

    return project, member


ProjectContext = Annotated[Tuple[Project, Optional[ProjectMember]], Depends(get_project_and_membership)]


# =============================================================================
# 3. DOCUMENT ACCESS (simplified — no org isolation)
# =============================================================================
async def get_document_with_access(
    document_id: uuid.UUID = Path(..., description="Target document UUID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tuple[Document, Project]:
    """
    Validates that the document exists and returns it.
    No org-tenant isolation in open-source mode.
    """
    stmt = (
        select(Document)
        .where(Document.id == document_id)
        .options(
            selectinload(Document.project),
            selectinload(Document.versions),
        )
    )
    res = await db.execute(stmt)
    document = res.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found.",
        )

    return document, document.project


DocumentContext = Annotated[Tuple[Document, Project], Depends(get_document_with_access)]
