"""Utilitários pequenos compartilhados."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> datetime:
    """Garante datetime com timezone (assume UTC se vier ingênuo)."""
    if dt is None:
        return utcnow()
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
