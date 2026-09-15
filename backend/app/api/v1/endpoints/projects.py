"""
Project authorization and member management endpoints.
"""

from typing import List, Optional, Tuple
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import (
    CurrentUser,
    DBSession,
    get_current_user,
    get_project_and_membership,
)
from app.models.document import Document
from app.models.organization import Organization
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import (
    DocumentSummaryResponse,
    ProjectCreateRequest,
    ProjectMemberResponse,
    ProjectSummaryResponse,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post(
    "",
    response_model=ProjectSummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new perception project",
    description="Creates a new project in the organization and assigns the creator as an admin.",
)
async def create_project(
    req: ProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectSummaryResponse:
    """Create a new project and add the creator as member."""
    org_id = current_user.organization_id
    if not org_id:
        org_stmt = select(Organization).limit(1)
        org_res = await db.execute(org_stmt)
        org = org_res.scalar_one_or_none()
        org_id = org.id if org else uuid.uuid4()

    new_project = Project(
        id=uuid.uuid4(),
        organization_id=org_id,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        status=ProjectStatus.active,
        settings=req.settings or {},
    )
    db.add(new_project)
    await db.flush()

    # Assign creator as project member
    role_id = current_user.role_id
    if not role_id:
        r_stmt = select(Role).where(Role.name.in_(["SUPER_ADMIN", "ADMIN"])).limit(1)
        r_res = await db.execute(r_stmt)
        r = r_res.scalar_one_or_none()
        role_id = r.id if r else None

    if role_id:
        pm = ProjectMember(
            id=uuid.uuid4(),
            project_id=new_project.id,
            user_id=current_user.id,
            role_id=role_id,
        )
        db.add(pm)

    await db.commit()
    await db.refresh(new_project)

    user_role_name = current_user.role.name.upper() if current_user.role else "ADMIN"
    return ProjectSummaryResponse(
        id=new_project.id,
        organization_id=new_project.organization_id,
        name=new_project.name,
        description=new_project.description,
        status=new_project.status.value if hasattr(new_project.status, "value") else str(new_project.status),
        settings=new_project.settings,
        user_role=user_role_name,
        created_at=new_project.created_at,
        updated_at=new_project.updated_at,
    )


@router.get(
    "",
    response_model=List[ProjectSummaryResponse],
    summary="List accessible projects",
    description="Returns projects that the user has explicit membership in, or all org projects if user is ADMIN.",
)
async def list_accessible_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ProjectSummaryResponse]:
    """Fetch all projects available to the authenticated user."""
    user_role_name = current_user.role.name.upper() if current_user.role else "VIEWER"

    if user_role_name in ("SUPER_ADMIN", "ADMIN"):
        stmt = select(Project).where(Project.organization_id == current_user.organization_id)
        if user_role_name == "SUPER_ADMIN":
            stmt = select(Project)
        stmt = stmt.order_by(Project.created_at.desc())
        res = await db.execute(stmt)
        projects = res.scalars().all()

        return [
            ProjectSummaryResponse(
                id=p.id,
                organization_id=p.organization_id,
                name=p.name,
                description=p.description,
                status=p.status.value if hasattr(p.status, "value") else str(p.status),
                settings=p.settings,
                user_role=user_role_name,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in projects
        ]

    # Standard users: fetch joined projects via project_members
    stmt = (
        select(Project, ProjectMember)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            ProjectMember.user_id == current_user.id,
            Project.organization_id == current_user.organization_id,
        )
        .options(selectinload(ProjectMember.role))
        .order_by(Project.name.asc())
    )
    res = await db.execute(stmt)
    records = res.all()

    return [
        ProjectSummaryResponse(
            id=proj.id,
            organization_id=proj.organization_id,
            name=proj.name,
            description=proj.description,
            status=proj.status.value if hasattr(proj.status, "value") else str(proj.status),
            settings=proj.settings,
            user_role=member.role.name if (member and member.role) else "VIEWER",
            created_at=proj.created_at,
            updated_at=proj.updated_at,
        )
        for proj, member in records
    ]


@router.get(
    "/{project_id}",
    response_model=ProjectSummaryResponse,
    summary="Get project details",
    description="Returns detailed project metadata if user has valid project membership.",
)
async def get_project_by_id(
    context: Tuple[Project, Optional[ProjectMember]] = Depends(get_project_and_membership),
    current_user: User = Depends(get_current_user),
) -> ProjectSummaryResponse:
    """Fetch single project metadata after verifying access."""
    project, member = context
    user_role_name = current_user.role.name.upper() if current_user.role else "VIEWER"

    project_role = user_role_name if user_role_name in ("SUPER_ADMIN", "ADMIN") else (
        member.role.name if (member and member.role) else "VIEWER"
    )

    return ProjectSummaryResponse(
        id=project.id,
        organization_id=project.organization_id,
        name=project.name,
        description=project.description,
        status=project.status.value if hasattr(project.status, "value") else str(project.status),
        settings=project.settings,
        user_role=project_role,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get(
    "/{project_id}/members",
    response_model=List[ProjectMemberResponse],
    summary="List project members",
    description="Returns assigned members and roles for this project. Requires project membership.",
)
async def list_project_members(
    context: Tuple[Project, Optional[ProjectMember]] = Depends(get_project_and_membership),
    db: AsyncSession = Depends(get_db),
) -> List[ProjectMemberResponse]:
    """List members assigned to the project."""
    project, _ = context

    stmt = (
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project.id)
        .options(selectinload(ProjectMember.role))
        .order_by(User.name.asc())
    )
    res = await db.execute(stmt)
    records = res.all()

    return [
        ProjectMemberResponse(
            user_id=user.id,
            name=user.name,
            email=user.email,
            avatar_url=user.avatar_url,
            role_name=member.role.name if member.role else "VIEWER",
            role_scope=member.role.scope.value if (member.role and hasattr(member.role.scope, "value")) else str(member.role.scope if member.role else ""),
            joined_at=member.joined_at,
        )
        for member, user in records
    ]


@router.get(
    "/{project_id}/documents",
    response_model=List[DocumentSummaryResponse],
    summary="List project documents",
    description="Returns technical documents attached to this project. Requires project membership.",
)
async def list_project_documents(
    context: Tuple[Project, Optional[ProjectMember]] = Depends(get_project_and_membership),
    db: AsyncSession = Depends(get_db),
) -> List[DocumentSummaryResponse]:
    """Fetch document catalog within the authorized project."""
    project, _ = context

    stmt = (
        select(Document)
        .where(Document.project_id == project.id)
        .order_by(Document.created_at.desc())
    )
    res = await db.execute(stmt)
    documents = res.scalars().all()

    return [
        DocumentSummaryResponse(
            id=d.id,
            project_id=d.project_id,
            organization_id=d.organization_id,
            title=d.title,
            description=d.description,
            doc_type=d.doc_type.value if hasattr(d.doc_type, "value") else str(d.doc_type),
            status=d.status.value if hasattr(d.status, "value") else str(d.status),
            source_url=d.source_url,
            file_size_bytes=d.file_size_bytes,
            mime_type=d.mime_type,
            page_count=d.page_count,
            language=d.language,
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in documents
    ]
