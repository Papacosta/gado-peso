"""Registro de pesagem real (balança) + sessão de fotos."""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..database import get_db
from ..models import Animal, CapturePoint, Weighing
from ..schemas import WeighingIn, WeighingOut
from ..utils import ensure_utc, utcnow

router = APIRouter(prefix="/api/weighings", tags=["pesagens"])


@router.get("", response_model=List[WeighingOut])
def list_weighings(
    animal_id: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Weighing)
        .options(selectinload(Weighing.photos))
        .order_by(Weighing.weighed_at.desc())
        .limit(limit)
    )
    if animal_id:
        stmt = stmt.where(Weighing.animal_id == animal_id)
    return db.scalars(stmt).all()


@router.post("", response_model=WeighingOut, status_code=201)
def create_weighing(payload: WeighingIn, db: Session = Depends(get_db)):
    """Cria a pesagem. Reenviar o mesmo id (fila offline) devolve o existente."""
    if payload.id:
        existing = db.get(Weighing, payload.id)
        if existing:
            return existing

    if not db.get(Animal, payload.animal_id):
        raise HTTPException(status_code=404, detail="Animal não encontrado. Cadastre-o antes.")
    if payload.capture_point_id and not db.get(CapturePoint, payload.capture_point_id):
        raise HTTPException(status_code=404, detail="Ponto de captura não encontrado.")

    weighing = Weighing(
        id=payload.id or str(uuid.uuid4()),
        animal_id=payload.animal_id,
        capture_point_id=payload.capture_point_id,
        weight_kg=payload.weight_kg,
        weighed_at=ensure_utc(payload.weighed_at),
        light_condition=payload.light_condition,
        time_of_day=payload.time_of_day,
        fasting=payload.fasting,
        notes=payload.notes,
        created_at=utcnow(),
    )
    db.add(weighing)
    db.commit()
    db.refresh(weighing)
    return weighing


@router.get("/{weighing_id}", response_model=WeighingOut)
def get_weighing(weighing_id: str, db: Session = Depends(get_db)):
    weighing = db.scalar(
        select(Weighing)
        .options(selectinload(Weighing.photos))
        .where(Weighing.id == weighing_id)
    )
    if not weighing:
        raise HTTPException(status_code=404, detail="Pesagem não encontrada.")
    return weighing


@router.get("/{weighing_id}/status")
def weighing_status(weighing_id: str, db: Session = Depends(get_db)):
    """Checklist de completude: 3 a 5 fotos por sessão."""
    weighing = db.scalar(
        select(Weighing)
        .options(selectinload(Weighing.photos))
        .where(Weighing.id == weighing_id)
    )
    if not weighing:
        raise HTTPException(status_code=404, detail="Pesagem não encontrada.")
    n = len(weighing.photos)
    warnings = []
    if n < settings.min_photos_per_weighing:
        warnings.append(
            f"Sessão com {n} foto(s); o protocolo pede de "
            f"{settings.min_photos_per_weighing} a {settings.max_photos_per_weighing}."
        )
    if n > settings.max_photos_per_weighing:
        warnings.append("Sessão acima do máximo de fotos do protocolo.")
    return {
        "weighing_id": weighing.id,
        "photos": n,
        "min_photos": settings.min_photos_per_weighing,
        "max_photos": settings.max_photos_per_weighing,
        "complete": settings.min_photos_per_weighing <= n <= settings.max_photos_per_weighing,
        "warnings": warnings,
    }
