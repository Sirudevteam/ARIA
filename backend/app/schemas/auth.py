"""
Pydantic schemas for authentication, user profiles, RBAC roles, and project authorization.
"""

from datetime import datetime
import json
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RoleInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    scope: str
    permissions: List[str] = Field(default_factory=list)
    description: Optional[str] = None

    @field_validator("permissions", mode="before")
    @classmethod
    def parse_permissions(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else [str(parsed)]
            except Exception:
                return [v]
        return list(v) if v is not None else []

    @field_validator("scope", mode="before")
    @classmethod
    def parse_scope(cls, v: Any) -> str:
        if hasattr(v, "value"):
            return v.value
        return str(v)


class OrganizationInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    logo_url: Optional[str] = None
    website: Optional[str] = None


class TeamInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str] = None


class ProjectAccessInfo(BaseModel):
    project_id: uuid.UUID
    project_name: str
    project_role: Optional[str] = None
    status: str
    joined_at: Optional[datetime] = None

    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: Any) -> str:
        if hasattr(v, "value"):
            return v.value
        return str(v)


class UserProfileResponse(BaseModel):
    """Complete user profile payload including organization, role, and authorized projects."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    avatar_url: Optional[str] = None
    status: str
    last_seen_at: Optional[datetime] = None
    organization: OrganizationInfo
    role: Optional[RoleInfo] = None
    teams: List[TeamInfo] = Field(default_factory=list)
    projects: List[ProjectAccessInfo] = Field(default_factory=list)
    effective_permissions: List[str] = Field(default_factory=list)

    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: Any) -> str:
        if hasattr(v, "value"):
            return v.value
        return str(v)

    @field_validator("effective_permissions", mode="before")
    @classmethod
    def parse_effective_permissions(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else [str(parsed)]
            except Exception:
                return [v]
        return list(v) if v is not None else []


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class ProjectMemberResponse(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str
    avatar_url: Optional[str] = None
    role_name: Optional[str] = None
    role_scope: Optional[str] = None
    joined_at: datetime


class ProjectSummaryResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: Optional[str] = None
    status: str
    settings: Dict[str, Any] = Field(default_factory=dict)
    user_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: Any) -> str:
        if hasattr(v, "value"):
            return v.value
        return str(v)

    @field_validator("settings", mode="before")
    @classmethod
    def parse_settings(cls, v: Any) -> Dict[str, Any]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return dict(v) if v is not None else {}


class DocumentSummaryResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    description: Optional[str] = None
    doc_type: str
    status: str
    source_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    page_count: Optional[int] = None
    language: str
    created_at: datetime
    updated_at: datetime

    @field_validator("doc_type", "status", mode="before")
    @classmethod
    def parse_enum_field(cls, v: Any) -> str:
        if hasattr(v, "value"):
            return v.value
        return str(v)
