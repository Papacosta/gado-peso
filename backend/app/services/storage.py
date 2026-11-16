"""Persistência de fotos em disco (data/photos).

O banco guarda o caminho RELATIVO ao diretório de fotos. O volume do Docker
mantém os arquivos entre reinícios.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from ..config import settings


class InvalidImageError(ValueError):
    pass


def decode_image(raw: bytes) -> np.ndarray:
    """Decodifica bytes em BGR; levanta erro amigável se não for imagem."""
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise InvalidImageError("Arquivo enviado não é uma imagem válida (JPEG/PNG).")
    return image


def save_photo(raw: bytes, image: np.ndarray) -> tuple[str, str]:
    """Salva a foto e devolve (caminho_relativo, sha256)."""
    digest = hashlib.sha256(raw).hexdigest()
    now = datetime.now(timezone.utc)
    subdir = Path(f"{now:%Y}/{now:%m}")
    target_dir = settings.photos_dir / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}.jpg"
    relative = str(subdir / filename)
    # Reencoda em JPEG de qualidade alta: normaliza formatos (HEIC não é
    # suportado pelo OpenCV; o frontend sempre envia JPEG do canvas).
    ok = cv2.imwrite(str(target_dir / filename), image, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not ok:
        raise OSError("Falha ao gravar a foto em disco.")
    return relative, digest


def photo_abs_path(relative: str) -> Path:
    return settings.photos_dir / relative
