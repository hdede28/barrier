"""Application configuration, loaded from environment variables (.env)."""
from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache


def _bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.environ.get(
            "DATABASE_URL",
            "postgresql+psycopg://pdftoolkit:pdftoolkit@localhost:5432/pdftoolkit",
        )
        # Root directory for the local, user-owned file store. Nothing under
        # this path is ever uploaded to a third party.
        self.data_dir: Path = Path(os.environ.get("DATA_DIR", "./data")).resolve()
        self.store_dir: Path = self.data_dir / "store"
        self.backup_dir: Path = self.data_dir / "backups"

        self.max_upload_mb: int = int(os.environ.get("MAX_UPLOAD_MB", "200"))
        self.default_retention_days: int | None = (
            int(os.environ["DEFAULT_RETENTION_DAYS"])
            if os.environ.get("DEFAULT_RETENTION_DAYS")
            else None
        )

        self.soffice_bin: str = os.environ.get("SOFFICE_BIN", "soffice")
        self.ocr_languages: str = os.environ.get("OCR_LANGUAGES", "eng")

        self.cors_origins: list[str] = [
            o.strip()
            for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
            if o.strip()
        ]

        # Optional SMTP for signature invitations. When unset, invitations are
        # recorded as local links only and the delivery outcome is logged as
        # "smtp_not_configured" rather than silently failing.
        self.smtp_host: str | None = os.environ.get("SMTP_HOST") or None
        self.smtp_port: int = int(os.environ.get("SMTP_PORT", "587"))
        self.smtp_user: str | None = os.environ.get("SMTP_USER") or None
        self.smtp_password: str | None = os.environ.get("SMTP_PASSWORD") or None
        self.smtp_from: str = os.environ.get("SMTP_FROM", "no-reply@localhost")

        self.app_base_url: str = os.environ.get("APP_BASE_URL", "http://localhost:3000")
        self.purge_interval_seconds: int = int(
            os.environ.get("PURGE_INTERVAL_SECONDS", "3600")
        )

    def ensure_dirs(self) -> None:
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s
