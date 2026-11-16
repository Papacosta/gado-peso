"""Configuração da aplicação, toda via variáveis de ambiente.

Suposições registradas no README:
- A câmera é fixa (mesmo ponto de captura). O modelo aprende a escala implícita.
- Fotos ficam em disco; o banco guarda apenas o caminho relativo.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "sim", "on"}


def _path_env(name: str, default: str) -> Path:
    return Path(os.getenv(name, default)).expanduser().resolve()


@dataclass(frozen=True)
class Settings:
    # Banco de dados (SQLAlchemy 2 + psycopg 3)
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://gado:gado@localhost:5432/gado",
    )

    # Diretórios persistentes
    data_dir: Path = field(default_factory=lambda: _path_env("DATA_DIR", "./data"))
    photos_dir: Path = field(default_factory=lambda: _path_env("PHOTOS_DIR", "./data/photos"))
    models_dir: Path = field(default_factory=lambda: _path_env("MODELS_DIR", "./data/models"))

    # CORS: em produção restrinja à origem do PWA.
    cors_origins: List[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "*").split(",")
            if o.strip()
        ]
    )

    # Regras de negócio
    min_animals_for_model: int = int(os.getenv("MIN_ANIMALS_FOR_MODEL", "30"))
    min_photos_per_weighing: int = int(os.getenv("MIN_PHOTOS_PER_WEIGHING", "3"))
    max_photos_per_weighing: int = int(os.getenv("MAX_PHOTOS_PER_WEIGHING", "5"))

    # Qualidade de imagem (limiares calibráveis)
    blur_threshold: float = float(os.getenv("BLUR_THRESHOLD", "60"))
    dark_threshold: float = float(os.getenv("DARK_THRESHOLD", "55"))
    bright_threshold: float = float(os.getenv("BRIGHT_THRESHOLD", "215"))
    glare_fraction_threshold: float = float(os.getenv("GLARE_FRACTION_THRESHOLD", "0.20"))

    # Inclinação máxima aceita (graus). O frontend também tem a sua tolerância.
    max_tilt_deg: float = float(os.getenv("MAX_TILT_DEG", "5"))

    # Fase 2
    segmentation_enabled: bool = _bool_env("SEGMENTATION_ENABLED", False)
    yolo_weights: str = os.getenv("YOLO_WEIGHTS", "yolov8n-seg.pt")

    # Modo passagem (câmera fixa, gado passando)
    max_frames_per_passage: int = int(os.getenv("MAX_FRAMES_PER_PASSAGE", "8"))

    # Upload
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "15"))

    def ensure_dirs(self) -> None:
        self.photos_dir.mkdir(parents=True, exist_ok=True)
        self.models_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
