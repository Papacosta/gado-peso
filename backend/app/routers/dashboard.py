"""Painel de coleta: totais, distribuições, metas e avisos."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Animal, CapturePoint, Photo, Weighing
from ..schemas import DashboardOut, WeightBucket
from ..services.training import model_status

router = APIRouter(prefix="/api/dashboard", tags=["painel"])

# Faixas de peso usadas no histograma e nos avisos de cobertura.
WEIGHT_BANDS = [
    ("até 150 kg", 0, 150),
    ("150-250 kg", 150, 250),
    ("250-350 kg", 250, 350),
    ("350-450 kg", 350, 450),
    ("450-550 kg", 450, 550),
    ("acima de 550 kg", 550, None),
]


def _count(db: Session, model) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def _group_counts(db: Session, column, model) -> dict:
    rows = db.execute(
        select(column, func.count()).select_from(model).group_by(column).order_by(func.count().desc())
    ).all()
    return {(str(key) if key is not None else "não informado"): int(count) for key, count in rows}


@router.get("/stats", response_model=DashboardOut)
def dashboard_stats(db: Session = Depends(get_db)):
    total_animals = _count(db, Animal)
    total_photos = _count(db, Photo)
    total_weighings = _count(db, Weighing)

    # Histograma de pesos (todas as pesagens).
    weights_by_band = []
    for label, low, high in WEIGHT_BANDS:
        stmt = select(func.count()).select_from(Weighing).where(Weighing.weight_kg >= low)
        if high is not None:
            stmt = stmt.where(Weighing.weight_kg < high)
        count = int(db.scalar(stmt) or 0)
        weights_by_band.append(
            WeightBucket(label=label, min_kg=low, max_kg=high, count=count)
        )

    by_breed = _group_counts(db, Animal.breed, Animal)
    by_category = _group_counts(db, Animal.category, Animal)
    by_sex = _group_counts(db, Animal.sex, Animal)

    # ---------------------- Avisos inteligentes --------------------------
    warnings: List[str] = []
    if total_animals < settings.min_animals_for_model:
        warnings.append(
            f"Faltam {settings.min_animals_for_model - total_animals} animais para o "
            f"primeiro teste (meta mínima: {settings.min_animals_for_model})."
        )
    if total_animals < 100:
        warnings.append(
            f"Meta para um modelo útil: 100+ animais. Atualmente: {total_animals}."
        )

    above_450 = int(
        db.scalar(
            select(func.count()).select_from(Weighing).where(Weighing.weight_kg >= 450)
        )
        or 0
    )
    if total_weighings and above_450 == 0:
        warnings.append(
            "Faltam animais acima de 450 kg: o modelo não aprenderá pesos altos."
        )
    elif above_450 < 3:
        warnings.append(
            f"Só há {above_450} pesagem(ns) acima de 450 kg; colete mais animais pesados."
        )

    if total_animals and total_photos < total_animals * settings.min_photos_per_weighing:
        warnings.append(
            "Média de fotos por animal abaixo do protocolo "
            f"({settings.min_photos_per_weighing}-{settings.max_photos_per_weighing} por sessão)."
        )

    n_points = _count(db, CapturePoint)
    if n_points > 1:
        warnings.append(
            f"Há {n_points} pontos de captura cadastrados. Fotos de pontos com distância/altura "
            "diferentes não são diretamente comparáveis; mantenha um ponto padrão por rebanho."
        )

    if total_animals and by_breed:
        top_breed, top_count = next(iter(by_breed.items()))
        if top_count / total_animals > 0.8:
            warnings.append(
                f"Pouca diversidade de raças: {top_count}/{total_animals} são '{top_breed}'. "
                "O modelo pode não generalizar para outras raças."
            )

    if total_photos and total_weighings == 0:
        warnings.append("Há fotos sem pesagem real associada; elas não entram no treino.")

    status = model_status(db)

    return DashboardOut(
        total_animals=total_animals,
        total_photos=total_photos,
        total_weighings=total_weighings,
        min_animals_for_model=settings.min_animals_for_model,
        weights=weights_by_band,
        by_breed=by_breed,
        by_category=by_category,
        by_sex=by_sex,
        warnings=warnings,
        model_status=status,
    )
