"""Upload de fotos com leituras de sensores (Fase 1, item 4).

- Recebe a imagem (multipart) + JSON de sensores do celular.
- Normaliza os sensores (interface única), calula fallback de luz pela
  imagem, roda a análise de qualidade (blur/exposição/reflexo) e, quando a
  segmentação está ligada, marca animal cortado na borda.
- Idempotente: reenviar a mesma foto (mesmo id da fila offline) não duplica.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..database import get_db
from ..models import Photo, Weighing
from ..schemas import PhotoOut
from ..services import image_quality as iq
from ..services.sensors import normalize_sensor_payload
from ..services.segmentation import get_segmenter
from ..services.storage import decode_image, photo_abs_path, save_photo
from ..utils import ensure_utc, utcnow

router = APIRouter(prefix="/api/photos", tags=["fotos"])


@router.post("", response_model=PhotoOut, status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    weighing_id: str = Form(...),
    photo_id: Optional[str] = Form(default=None),
    captured_at: Optional[str] = Form(default=None),
    sensors: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
):
    # Idempotência da fila offline: mesmo id já salvo -> devolve o existente.
    if photo_id:
        existing = db.get(Photo, photo_id)
        if existing:
            return existing

    weighing = db.scalar(
        select(Weighing).options(selectinload(Weighing.photos)).where(Weighing.id == weighing_id)
    )
    if not weighing:
        raise HTTPException(status_code=404, detail="Pesagem não encontrada.")

    # Limite do protocolo (3 a 5 fotos por sessão; tolera deduplicação).
    if len(weighing.photos) >= settings.max_photos_per_weighing + 2:
        raise HTTPException(
            status_code=409,
            detail=f"Máximo de {settings.max_photos_per_weighing + 2} fotos por sessão.",
        )

    raw = await file.read()
    if len(raw) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Foto maior que {settings.max_upload_mb} MB. Configure a câmera do app.",
        )

    try:
        image = decode_image(raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    payload_sensors: Optional[dict] = None
    if sensors:
        try:
            payload_sensors = json.loads(sensors)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="Campo 'sensors' não é JSON válido.") from exc

    # --- Qualidade da imagem -------------------------------------------
    quality = iq.analyze_image(image)

    # --- Sensores: normalização + fallback de luz via brilho da imagem ---
    sensor_payload, sensor_warnings = normalize_sensor_payload(payload_sensors, image_brightness=quality["brightness"])
    if not sensor_payload["ambient_light"]["available"]:
        approx_lux = round(quality["brightness"] * 4.0)
        sensor_payload["ambient_light"] = {
            "available": False,
            "lux": approx_lux,
            "source": "image_fallback",
        }
    if sensor_warnings:
        quality.setdefault("warnings", []).extend(sensor_warnings)

    # --- Enquadramento (usa máscara se a Fase 2 estiver ligada) ---------
    if settings.segmentation_enabled:
        try:
            mask = get_segmenter().segment(image)
            iq.apply_mask_quality(quality, mask)
        except Exception:  # segmentação nunca deve bloquear a coleta
            quality["mask_touches_border"] = None

    relative_path, digest = save_photo(raw, image)
    h, w = image.shape[:2]

    captured_ts = utcnow()
    if captured_at:
        try:
            captured_ts = ensure_utc(datetime.fromisoformat(captured_at.replace("Z", "+00:00")))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Data de captura inválida.") from exc

    photo = Photo(
        id=photo_id or str(uuid.uuid4()),
        weighing_id=weighing.id,
        animal_id=weighing.animal_id,
        capture_point_id=weighing.capture_point_id,
        file_path=relative_path,
        sha256=digest,
        width=w,
        height=h,
        sensors=sensor_payload,
        quality=quality,
        captured_at=captured_ts,
        created_at=utcnow(),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.get("", response_model=list[PhotoOut])
def list_photos(animal_id: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db)):
    stmt = select(Photo).order_by(Photo.captured_at.desc()).limit(limit)
    if animal_id:
        stmt = stmt.where(Photo.animal_id == animal_id)
    return db.scalars(stmt).all()


@router.get("/{photo_id}")
def get_photo(photo_id: str, db: Session = Depends(get_db)):
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada.")
    return photo


@router.get("/{photo_id}/file")
def get_photo_file(photo_id: str, db: Session = Depends(get_db)):
    """Serve o arquivo da foto para o app exibir."""
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada.")
    path = photo_abs_path(photo.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Arquivo ausente no disco.")
    return FileResponse(str(path), media_type="image/jpeg", filename=path.name)
