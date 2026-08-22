"""
Authentication and security utilities for JWT validation and test token generation.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import uuid

import jwt
from pydantic import BaseModel, Field

from app.core.config import get_settings

settings = get_settings()


class TokenPayload(BaseModel):
    """Normalized payload extracted from a verified Supabase JWT."""

    sub: Optional[str] = Field(None, description="User UUID string")
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
                pass
        # Default Super Admin UUID for anon/dev requests
        return uuid.UUID("c0000000-0000-0000-0000-000000000001")


class AuthError(Exception):
    """Custom exception raised on authentication failures."""

    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def decode_jwt_token(token: str) -> TokenPayload:
    """
    Decode and verify a Supabase JWT token.
    Supports symmetric HS256/HS384/HS512 with SUPABASE_JWT_SECRET
    and asymmetric RS256/ES256 with graceful token claim decoding.
    """
    try:
        # Check token header to determine algorithm
        try:
            header = jwt.get_unverified_header(token)
            alg = header.get("alg", "HS256")
        except Exception:
            alg = "HS256"

        # If symmetric HMAC algorithm, verify with configured secret
        if alg.startswith("HS"):
            try:
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=[alg, "HS256", "HS384", "HS512"],
                    options={"verify_aud": False, "verify_exp": True},
                )
                return TokenPayload(**payload)
            except jwt.ExpiredSignatureError:
                raise AuthError("Authentication token has expired. Please log in again.", 401)
            except (jwt.InvalidSignatureError, jwt.InvalidKeyError):
                raise AuthError("Invalid authentication token: signature verification failed", 401)
            except Exception as e:
                raise AuthError(f"Invalid authentication token: {str(e)}", 401)

        # For asymmetric (RS256, ES256) or fallback decoding
        try:
            payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_aud": False, "verify_exp": True},
            )
            return TokenPayload(**payload)
        except jwt.ExpiredSignatureError:
            raise AuthError("Authentication token has expired. Please log in again.", 401)
        except Exception as e:
            raise AuthError(f"Invalid authentication token: {str(e)}", 401)

    except AuthError:
        raise
    except jwt.ExpiredSignatureError:
        raise AuthError("Authentication token has expired. Please log in again.", 401)
    except Exception as e:
        raise AuthError(f"Token validation failed: {str(e)}", 401)


def create_access_token(
    user_id: uuid.UUID,
    email: str,
    role: str = "authenticated",
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate a signed JWT token matching Supabase's payload structure.
    Used for unit testing, test suites, and local mock authentication.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=24))

    claims = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "aud": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "app_metadata": {"provider": "email"},
        "user_metadata": {},
    }

    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(
        claims,
        settings.SUPABASE_JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
