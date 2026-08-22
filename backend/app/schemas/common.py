"""
Shared Pydantic response schemas.
"""

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class HealthResponse(BaseModel):
    """Response schema for the health check endpoint."""

    status: str = Field(..., examples=["ok"])
    app_name: str
    version: str
    environment: str
    database: str = Field(..., examples=["connected", "unreachable"])


class APIResponse(BaseModel, Generic[DataT]):
    """Generic API response wrapper."""

    success: bool = True
    message: Optional[str] = None
    data: Optional[DataT] = None


class ErrorResponse(BaseModel):
    """Standard error response."""

    success: bool = False
    error: str
    detail: Optional[Any] = None
