"""Aplicação FastAPI (backend)."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import (
    auth,
    capture_points,
    animals,
    weighings,
    photos,
    dashboard,
    export,
    model,
    passages,
)

settings.ensure_dirs()

app = FastAPI(
    title="PesoVivo API",
    version="0.1.0",
    description=(
        "API para coleta padronizada de fotos de bovinos (Fase 1) e "
        "estimativa de peso via regressão sobre máscara segmentada (Fase 2)."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials="*" not in settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Login (tela própria + cookie)
app.include_router(auth.router)

# Rotas da Fase 1
app.include_router(capture_points.router)
app.include_router(animals.router)
app.include_router(weighings.router)
app.include_router(photos.router)
app.include_router(dashboard.router)
app.include_router(export.router)

# Rotas da Fase 2 (estrutura)
app.include_router(model.router)

# Modo passagem (câmera fixa, gado passando)
app.include_router(passages.router)

# Serve fotos para visualização no frontend
app.mount("/photos", StaticFiles(directory=str(settings.photos_dir)), name="photos")


@app.get("/api/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}