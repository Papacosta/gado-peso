"""Endpoints da Fase 2: treino, ativação, histórico e estimativa.

A estimativa só é possível quando existe versão ativa do modelo; os erros
retornam motivo claro (falta de dados, segmentação desligada, foto ruim).
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ModelVersion
from ..schemas import EstimateOut, ModelStatusOut, ModelVersionOut, TrainOut, TrainRequest
from ..services.estimation import EstimationUnavailableError, estimate_photo
from ..services.storage import decode_image
from ..services.training import TrainingUnavailableError, model_status, train_model

router = APIRouter(prefix="/api/model", tags=["modelo"])


@router.get("/status", response_model=ModelStatusOut)
def status(db: Session = Depends(get_db)):
    return model_status(db)


@router.get("/versions", response_model=List[ModelVersionOut])
def versions(db: Session = Depends(get_db)):
    return db.scalars(
        select(ModelVersion).order_by(ModelVersion.trained_at.desc())
    ).all()


@router.post("/train", response_model=TrainOut)
def train(payload: TrainRequest, db: Session = Depends(get_db)):
    """Botão "Retreinar modelo": usa todas as pesagens cadastradas."""
    try:
        version = train_model(db, algorithm=payload.algorithm or "ridge", activate=payload.activate)
    except TrainingUnavailableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:  # ex.: ultralytics ausente
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return TrainOut(
        model=ModelVersionOut.model_validate(version),
        message="Treino concluído. Modelo ativado e pronto para estimar.",
    )


@router.post("/activate/{version_id}", response_model=ModelVersionOut)
def activate(version_id: str, db: Session = Depends(get_db)):
    from sqlalchemy import update

    version = db.get(ModelVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Versão não encontrada.")
    db.execute(update(ModelVersion).values(active=False))
    version.active = True
    db.commit()
    db.refresh(version)
    return version


@router.post("/estimate", response_model=EstimateOut)
async def estimate(
    file: UploadFile = File(...),
    capture_point_id: str = Form(...),
    breed: Optional[str] = Form(default=None),
    sex: Optional[str] = Form(default=None),
    category: Optional[str] = Form(default=None),
    age_months: Optional[int] = Form(default=None),
    bcs: Optional[float] = Form(default=None),
    db: Session = Depends(get_db),
):
    """Estima o peso de um animal a partir de uma foto avulsa."""
    raw = await file.read()
    try:
        image = decode_image(raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        return estimate_photo(
            db,
            image,
            capture_point_id=capture_point_id,
            breed=breed,
            sex=sex,
            category=category,
            age_months=age_months,
            bcs=bcs,
        )
    except EstimationUnavailableError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
