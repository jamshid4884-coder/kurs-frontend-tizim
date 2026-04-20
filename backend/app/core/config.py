from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BASE_DIR.parents[0]


def _normalize_database_url(value: str) -> str:
    raw = value.strip()

    if not raw:
        raw = "postgresql+psycopg://postgres@localhost:5432/"

    if raw.startswith("postgresql://"):
        raw = raw.replace("postgresql://", "postgresql+psycopg://", 1)
    elif raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql+psycopg://", 1)

    parsed = urlparse(raw)
    path = parsed.path.lstrip("/")

    if path:
        return raw

    normalized_path = "/kurs_boshqaruv"

    return parsed._replace(path=normalized_path).geturl()


class Settings(BaseSettings):
    app_name: str = "Kurs Boshqaruv API"
    api_prefix: str = "/api"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: Literal["development", "production", "test"] = "development"
    cors_origin: str = "http://localhost:5173"
    center_name: str = "Nova Education Center"

    database_url: str = Field(
        default="postgresql+psycopg://postgres@localhost:5432/",
        alias="DATABASE_URL",
    )

    jwt_access_secret: str = "set-in-local-env"
    jwt_refresh_secret: str = "set-in-local-env"
    demo_user_password: str | None = None
    credential_secret: str | None = None
    telegram_bot_username: str | None = Field(default=None, alias="TELEGRAM_BOT_USERNAME")
    telegram_bot_token: str | None = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    jwt_access_ttl: str = "15m"
    jwt_refresh_ttl: str = "7d"

    reset_token_ttl_minutes: int = 30

    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @computed_field  # type: ignore[misc]
    @property
    def normalized_database_url(self) -> str:
        return _normalize_database_url(self.database_url)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
