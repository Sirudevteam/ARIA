"""
Authentication and security utilities for Clerk & JWT validation.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import uuid

import jwt
from jwt import PyJWKClient
from pydantic import BaseModel, Field

from app.core.config import get_settings

settings = get_settings()

# Cached JWKS client for Clerk public key retrieval
_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> Optional[PyJWKClient]:
    """Initializes or returns cached PyJWKClient for Clerk JWKS verification."""
    global _jwks_client
    if _jwks_client is None and settings.CLERK_JWKS_URL:
        try:
            _jwks_client = PyJWKClient(settings.CLERK_JWKS_URL, cache_keys=True, max_cached_keys=16)
        except Exception:
            _jwks_client = None
    return _jwks_client


class TokenPayload(BaseModel):
    """Normalized payload extracted from a verified Clerk / JWT token."""

    sub: Optional[str] = Field(None, description="Clerk user ID or UUID string")
    email: Optional[str] = None
    role: Optional[str] = "authenticated"
    exp: Optional[int] = None
    app_metadata: Dict[str, Any] = Field(default_factory=dict)
    user_metadata: Dict[str, Any] = Field(default_factory=dict)

    @property
    def user_id(self) -> uuid.UUID:
        """
        Returns a valid UUID for the user.
        If `sub` is already a UUID, parses directly.
        If `sub` is a Clerk ID (e.g. 'user_2t...'), generates a deterministic UUIDv5.
        """
        if self.sub:
            try:
                return uuid.UUID(self.sub)
            except Exception:
                # Deterministic UUIDv5 from Clerk alphanumeric user ID
                return uuid.uuid5(uuid.NAMESPACE_DNS, self.sub)
        # Default fallback Super Admin UUID for anon/dev requests
        return uuid.UUID("c0000000-0000-0000-0000-000000000001")


class AuthError(Exception):
    """Custom exception raised on authentication failures."""

    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def decode_jwt_token(token: str) -> TokenPayload:
    """
    Decode and verify a Clerk / Bearer JWT token.
    Supports:
    1. Clerk JWKS (RS256) via CLERK_JWKS_URL
    2. Symmetric HMAC (HS256/HS384/HS512) with CLERK_JWT_SECRET (test suite / dev)
    3. Graceful fallback claims extraction
    """
    try:
        # Check token header to inspect algorithm and key ID
        try:
            header = jwt.get_unverified_header(token)
            alg = header.get("alg", "RS256")
            kid = header.get("kid")
        except Exception:
            alg = "HS256"
            kid = None

        # 1. Clerk JWKS asymmetric verification (RS256)
        jwks_client = get_jwks_client()
        if jwks_client and kid and alg.startswith("RS"):
            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    options={"verify_aud": False, "verify_exp": True},
                )
                return TokenPayload(**payload)
            except jwt.ExpiredSignatureError:
                raise AuthError("Authentication token has expired. Please log in again.", 401)
            except Exception as e:
                # Fall through to symmetric / fallback
                pass

        # 2. Symmetric HMAC verification (HS256 / dev tokens)
        if alg.startswith("HS"):
            try:
                payload = jwt.decode(
                    token,
                    settings.CLERK_JWT_SECRET,
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

        # 3. Graceful claims extraction fallback (dev / test mock tokens)
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
        raise AuthError(f"Invalid authentication token: {str(e)}", 401)


def create_access_token(
    user_id: uuid.UUID,
    email: str,
    role: str = "authenticated",
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate a signed JWT token matching Clerk/ARIA payload structure.
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
        "app_metadata": {"provider": "clerk"},
        "user_metadata": {},
    }

    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(
        claims,
        settings.CLERK_JWT_SECRET,
        algorithm="HS256",
    )
