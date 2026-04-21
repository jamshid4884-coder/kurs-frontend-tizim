from __future__ import annotations

import base64
import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import get_settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=10)


def _credential_fernet() -> Fernet:
    settings = get_settings()
    raw_secret = (settings.credential_secret or settings.jwt_access_secret).encode("utf-8")
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(raw_secret).digest())
    return Fernet(derived_key)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def password_needs_update(hashed_password: str) -> bool:
    return pwd_context.needs_update(hashed_password)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def encrypt_secret(value: str) -> str:
    return _credential_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    try:
        return _credential_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Admin credential secretni o'qib bo'lmadi.") from exc


def parse_ttl(value: str) -> timedelta:
    normalized = value.strip().lower()

    if normalized.endswith("m"):
        return timedelta(minutes=int(normalized[:-1]))

    if normalized.endswith("h"):
        return timedelta(hours=int(normalized[:-1]))

    if normalized.endswith("d"):
        return timedelta(days=int(normalized[:-1]))

    return timedelta(minutes=int(normalized))


def create_token(
    subject: str,
    token_type: str,
    secret: str,
    ttl: str,
    extra: dict[str, Any] | None = None,
) -> str:
    expires_at = datetime.now(UTC) + parse_ttl(ttl)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "exp": expires_at,
        "iat": datetime.now(UTC),
    }

    if extra:
        payload.update(extra)

    return jwt.encode(payload, secret, algorithm="HS256")


def create_access_token(subject: str, role: str) -> str:
    settings = get_settings()
    return create_token(
        subject=subject,
        token_type="access",
        secret=settings.jwt_access_secret,
        ttl=settings.jwt_access_ttl,
        extra={"role": role},
    )


def create_refresh_token(subject: str) -> str:
    settings = get_settings()
    return create_token(
        subject=subject,
        token_type="refresh",
        secret=settings.jwt_refresh_secret,
        ttl=settings.jwt_refresh_ttl,
    )


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    secret = settings.jwt_access_secret if expected_type == "access" else settings.jwt_refresh_secret

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError as exc:
        raise ValueError(f"Invalid {expected_type} token") from exc

    if payload.get("type") != expected_type:
        raise ValueError(f"Invalid {expected_type} token")

    return payload
