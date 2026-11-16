"""CRUD dos pontos de captura (perfil de estação)."""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CapturePoint
from ..schemas import CapturePointIn, CapturePointOut
from ..utils import utcnow

router = APIRouter(prefix="/api/capture-points", tags=["pontos de captura"])


@router.get("", response_model=List[CapturePointOut])
def list_capture_points(db: Session = Depends(get_db)):
    return db.scalars(select(CapturePoint).order_by(CapturePoint.created_at.desc())).all()


@router.post("", response_model=CapturePointOut, status_code=201)
def upsert_capture_point(payload: CapturePointIn, db: Session = Depends(get_db)):
    """Cria ou atualiza (idempotente pelo id gerado no app).

    Cada foto é sempre vinculada a um ponto; trocar distância/altura
    invalida a comparação, por isso os valores são obrigatórios.
    """
    existing: Optional[CapturePoint] = db.get(CapturePoint, payload.id) if payload.id else None
    if existing:
        for field, value in payload.model_dump(exclude={"id"}).items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing

    cp = CapturePoint(
        id=payload.id or str(uuid.uuid4()),
        name=payload.name,
        device_model=payload.device_model,
        distance_cm=payload.distance_cm,
        camera_height_cm=payload.camera_height_cm,
        notes=payload.notes,
        created_at=utcnow(),
    )
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp


@router.get("/{capture_point_id}", response_model=CapturePointOut)
def get_capture_point(capture_point_id: str, db: Session = Depends(get_db)):
    cp = db.get(CapturePoint, capture_point_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Ponto de captura não encontrado.")
    return cp
