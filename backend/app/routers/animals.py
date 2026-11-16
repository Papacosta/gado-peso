"""CRUD de animais."""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Animal
from ..schemas import AnimalIn, AnimalOut
from ..utils import utcnow

router = APIRouter(prefix="/api/animals", tags=["animais"])


@router.get("", response_model=List[AnimalOut])
def list_animals(
    q: Optional[str] = Query(default=None, description="Busca por brinco/ID"),
    db: Session = Depends(get_db),
):
    stmt = select(Animal).order_by(Animal.created_at.desc())
    if q:
        stmt = stmt.where(or_(Animal.ear_tag.ilike(f"%{q}%"), Animal.notes.ilike(f"%{q}%")))
    return db.scalars(stmt).all()


@router.post("", response_model=AnimalOut, status_code=201)
def upsert_animal(payload: AnimalIn, db: Session = Depends(get_db)):
    """Cria ou atualiza um animal. Idempotente pelo id do cliente."""
    existing: Optional[Animal] = db.get(Animal, payload.id) if payload.id else None
    if existing:
        for field, value in payload.model_dump(exclude={"id"}).items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing

    duplicate = db.scalar(select(Animal).where(Animal.ear_tag == payload.ear_tag))
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=f"Já existe um animal com o brinco/ID '{payload.ear_tag}'.",
        )

    animal = Animal(
        id=payload.id or str(uuid.uuid4()),
        ear_tag=payload.ear_tag,
        breed=payload.breed,
        sex=payload.sex,
        category=payload.category,
        age_months=payload.age_months,
        bcs=payload.bcs,
        notes=payload.notes,
        created_at=utcnow(),
    )
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return animal


@router.get("/{animal_id}", response_model=AnimalOut)
def get_animal(animal_id: str, db: Session = Depends(get_db)):
    animal = db.get(Animal, animal_id)
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado.")
    return animal
