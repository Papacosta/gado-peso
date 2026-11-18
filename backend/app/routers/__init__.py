"""Ponto de entrada dos routers."""
from . import auth, capture_points, animals, weighings, photos, dashboard, export, model, passages

__all__ = [
    "auth",
    "capture_points",
    "animals",
    "weighings",
    "photos",
    "dashboard",
    "export",
    "model",
    "passages",
]