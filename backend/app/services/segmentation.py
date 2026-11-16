"""Segmentação do animal com modelo genérico pré-treinado (Fase 2, item 1).

Interface abstrata `SegmentationProvider` para que, no futuro, seja possível
plugar um segmentador nativo (ARCore/ARKit/Core ML) sem mudar o resto do app.

O YOLO é usado APENAS para recortar a silhueta (classe COCO "cow" = 19).
Nenhum peso ou dado de terceiros é usado no treinamento do estimador.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional, Protocol

import cv2
import numpy as np

from ..config import settings


class SegmentationProvider(Protocol):
    name: str

    def segment(self, image_bgr: np.ndarray) -> Optional[np.ndarray]:
        """Retorna máscara booleana NxM ou None se nenhum animal for achado."""
        ...


class NullSegmenter:
    """Usado quando a Fase 2 está desligada (imagem sem ultralytics)."""

    name = "none"

    def segment(self, image_bgr: np.ndarray) -> Optional[np.ndarray]:
        return None


class CowYoloSegmenter:
    """Segmentador YOLOv8-seg (COCO), restrito à classe 'cow'."""

    name = "yolov8-seg-cow"
    COW_CLASS_ID = 19  # índice da classe "cow" no COCO

    def __init__(self, weights: str | None = None) -> None:
        self.weights = weights or settings.yolo_weights
        self._model = None

    def _load(self):
        if self._model is None:
            try:
                from ultralytics import YOLO  # import preguiçoso (pesado)
            except ImportError as exc:  # pragma: no cover - depende do ambiente
                raise RuntimeError(
                    "ultralytics não instalado. Rode `pip install -r requirements-ml.txt` "
                    "ou build com INSTALL_ML=true."
                ) from exc
            self._model = YOLO(self.weights)
        return self._model

    def segment(self, image_bgr: np.ndarray) -> Optional[np.ndarray]:
        model = self._load()
        results = model.predict(
            image_bgr,
            classes=[self.COW_CLASS_ID],
            conf=0.25,
            verbose=False,
        )
        if not results:
            return None
        result = results[0]
        if result.masks is None or len(result.masks.data) == 0:
            return None

        # Escolhe a maior máscara (animal mais próximo/central).
        masks = result.masks.data.cpu().numpy()
        best = max(masks, key=lambda m: float(m.sum()))
        h, w = image_bgr.shape[:2]
        if best.shape != (h, w):
            best = cv2.resize(best, (w, h), interpolation=cv2.INTER_NEAREST)
        return (best > 0.5).astype(bool)


@lru_cache(maxsize=1)
def get_segmenter() -> SegmentationProvider:
    """Segmentador global conforme configuração (SEGMENTATION_ENABLED)."""
    if settings.segmentation_enabled:
        return CowYoloSegmenter()
    return NullSegmenter()
