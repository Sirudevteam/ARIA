"""
Security utilities for ARIA (open-source mode — no authentication).
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class TokenPayload(BaseModel):
    """Normalized payload for the default open-source user."""

    sub: Optional[str] = Field(None, description="User ID string")
    email: Optional[str] = None
    role: Optional[str] = "authenticated"
    exp: Optional[int] = None
    app_metadata: Dict[str, Any] = Field(default_factory=dict)
    user_metadata: Dict[str, Any] = Field(default_factory=dict)

    @property
    def user_id(self) -> uuid.UUID:
        if self.sub:
            try:
                return uuid.UUID(self.sub)
            except Exception:
                return uuid.uuid5(uuid.NAMESPACE_DNS, self.sub)
        return uuid.UUID("c0000000-0000-0000-0000-000000000001")


class AuthError(Exception):
    """Custom exception raised on authentication failures."""

    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
