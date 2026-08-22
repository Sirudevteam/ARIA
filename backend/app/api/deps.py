"""
FastAPI dependencies for authentication, database sessions, and multi-layered RBAC authorization.
"""

from collections.abc import AsyncGenerator
from typing import Annotated, Callable, List, Optional, Tuple
import uuid

from fastapi import Depends, Header, HTTPException, Path, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import AuthError, decode_jwt_token
from app.models.document import Document
from app.models.organization import Organization
from app.models.project import Project, ProjectMember
from app.models.role import Role
from app.models.team import Team, TeamMember
from app.models.user import User, UserStatus

# ── Security Scheme ────────────────────────────────────────────────────────────
security_bearer = HTTPBearer(auto_error=False)

# ── Database Dependency Shortcut ───────────────────────────────────────────────
DBSession = Annotated[AsyncSession, Depends(get_db)]


# =============================================================================
# 1. AUTHENTICATION: get_current_user
# =============================================================================
async def get_current_user(
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates the Bearer JWT token from the Authorization header,
    looks up the user in the database, and verifies their account status.

    Raises:
        HTTPException(401): If no token provided, invalid signature, or token expired.
        HTTPException(403): If the user is inactive or suspended.
    """
    if not auth_header or not auth_header.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials. Please include 'Authorization: Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.credentials

    try:
        payload = decode_jwt_token(token)
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Lookup the user in the database by ID or email
    from sqlalchemy import or_

    conditions = [User.id == payload.user_id]
    if payload.email:
        conditions.append(User.email == payload.email)

    stmt = (
        select(User)
        .where(or_(*conditions))
        .options(
            selectinload(User.role),
            selectinload(User.organization),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Auto-provision verified Supabase user into database
        org_stmt = select(Organization).limit(1)
        org_res = await db.execute(org_stmt)
        org = org_res.scalar_one_or_none()

        role_stmt = select(Role).where(Role.name.in_(["SUPER_ADMIN", "ADMIN"])).limit(1)
        role_res = await db.execute(role_stmt)
        role = role_res.scalar_one_or_none()

        user = User(
            id=payload.user_id,
            email=payload.email or f"{payload.user_id}@supabase.auth",
            name=payload.user_metadata.get("name") or payload.email.split("@")[0] if payload.email else "Admin User",
            organization_id=org.id if org else None,
            role_id=role.id if role else None,
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

    # Validate user status
    if user.status == UserStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is suspended. Please contact your organization administrator.",
        )
    elif user.status == UserStatus.inactive:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# =============================================================================
# 2. ROLE-BASED ACCESS CONTROL (RBAC): require_roles
# =============================================================================
def require_roles(*allowed_roles: str) -> Callable:
    """
    Dependency factory to enforce system/org role requirements.
    SUPER_ADMIN always bypasses role restrictions.

    Example:
        @router.get("/admin-only", dependencies=[Depends(require_roles("ADMIN", "MANAGER"))])
    """
    normalized_allowed = [r.upper() for r in allowed_roles]

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        user_role_name = current_user.role.name.upper() if current_user.role else "VIEWER"

        # SUPER_ADMIN has full system-wide access
        if user_role_name == "SUPER_ADMIN":
            return current_user

        if user_role_name not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access forbidden: requires one of roles [{', '.join(normalized_allowed)}]. "
                    f"Your current role is '{user_role_name}'."
                ),
            )
        return current_user

    return role_checker


# =============================================================================
# 3. PROJECT ACCESS CONTROL: require_project_access
# =============================================================================
async def get_project_and_membership(
    project_id: uuid.UUID = Path(..., description="Target project UUID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tuple[Project, Optional[ProjectMember]]:
    """
    Verifies that:
    1. The project exists.
    2. The project belongs to the user's organization (or user is SUPER_ADMIN).
    3. The user is a member of the project (or is an ADMIN / SUPER_ADMIN).

    Returns:
        Tuple[Project, Optional[ProjectMember]]
    """
    # 1. Fetch project
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

    user_role_name = current_user.role.name.upper() if current_user.role else "VIEWER"

    # Multi-tenant check: ensure project is in the user's organization
    if user_role_name != "SUPER_ADMIN" and project.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found.",
        )

    # 2. Fetch project membership
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

    # SUPER_ADMIN and ADMIN have full project visibility in their org
    if user_role_name in ("SUPER_ADMIN", "ADMIN"):
        return project, member

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Access denied: you are not assigned as a member of project '{project.name}'. "
                "Please request access from your Project Manager or Admin."
            ),
        )

    return project, member


ProjectContext = Annotated[Tuple[Project, Optional[ProjectMember]], Depends(get_project_and_membership)]


def require_project_roles(*allowed_project_roles: str) -> Callable:
    """
    Dependency factory ensuring the user has one of specific project roles.
    SUPER_ADMIN and ADMIN always bypass project role restrictions.
    """
    normalized = [r.upper() for r in allowed_project_roles]

    async def project_role_checker(
        context: Tuple[Project, Optional[ProjectMember]] = Depends(get_project_and_membership),
        current_user: User = Depends(get_current_user),
    ) -> Tuple[Project, Optional[ProjectMember]]:
        project, member = context
        user_org_role = current_user.role.name.upper() if current_user.role else "VIEWER"

        if user_org_role in ("SUPER_ADMIN", "ADMIN"):
            return project, member

        member_role = member.role.name.upper() if (member and member.role) else "VIEWER"

        if member_role not in normalized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Action requires project role in [{', '.join(normalized)}]. "
                    f"Your project role is '{member_role}'."
                ),
            )
        return project, member

    return project_role_checker


# =============================================================================
# 4. DOCUMENT ACCESS CONTROL: require_document_access
# =============================================================================
async def get_document_with_access(
    document_id: uuid.UUID = Path(..., description="Target document UUID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tuple[Document, Project]:
    """
    Validates that:
    1. Document exists.
    2. Document belongs to user's organization.
    3. User has project membership for the document's parent project (or is ADMIN/SUPER_ADMIN).
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

    user_role_name = current_user.role.name.upper() if current_user.role else "VIEWER"

    if user_role_name != "SUPER_ADMIN" and document.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' not found.",
        )

    # Validate project membership
    if user_role_name not in ("SUPER_ADMIN", "ADMIN"):
        stmt_member = select(ProjectMember).where(
            ProjectMember.project_id == document.project_id,
            ProjectMember.user_id == current_user.id,
        )
        res_member = await db.execute(stmt_member)
        if not res_member.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you do not have permission to view documents in this project.",
            )

    return document, document.project


DocumentContext = Annotated[Tuple[Document, Project], Depends(get_document_with_access)]
