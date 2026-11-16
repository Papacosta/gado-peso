"""Validação automática de qualidade da foto.

Usa análise de imagem (OpenCV) e, quando disponível, a máscara da
segmentação para detectar animal cortado. Nunca bloqueia o upload: apenas
gera avisos que o app mostra e que ficam salvos no JSONB `quality`.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import cv2
import numpy as np

from ..config import settings


def _laplacian_variance(gray: np.ndarray) -> float:
    """Variância do Laplaciano: quanto menor, mais borrada."""
    h, w = gray.shape[:2]
    scale = 640.0 / max(h, w)
    if scale < 1:
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def analyze_image(image_bgr: np.ndarray) -> Dict[str, Any]:
    """Calcula métricas de nitidez, exposição e estouro de luz."""
    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("Imagem vazia para análise de qualidade.")

    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    blur_score = _laplacian_variance(gray)
    brightness = float(gray.mean())
    dark_fraction = float((gray < 25).mean())
    bright_fraction = float((gray > 245).mean())

    warnings: list[str] = []
    is_blurry = blur_score < settings.blur_threshold
    is_dark = brightness < settings.dark_threshold
    is_overexposed = brightness > settings.bright_threshold
    is_glary = bright_fraction > settings.glare_fraction_threshold

    if is_blurry:
        warnings.append("Foto possivelmente borrada (pouca nitidez). Segure o celular firme.")
    if is_dark:
        warnings.append("Foto escura. Melhore a iluminação ou evite sombra sobre o animal.")
    if is_overexposed:
        warnings.append("Foto clara demais. Evite sol direto na lente.")
    if is_glary:
        warnings.append("Reflexo/estouro de luz em parte da imagem.")

    return {
        "blur_score": round(blur_score, 2),
        "is_blurry": is_blurry,
        "brightness": round(brightness, 2),
        "is_dark": is_dark,
        "is_overexposed": is_overexposed,
        "bright_fraction": round(bright_fraction, 4),
        "dark_fraction": round(dark_fraction, 4),
        "is_glary": is_glary,
        "width": int(w),
        "height": int(h),
        "mask_touches_border": None,  # preenchido depois da segmentação, se houver
        "warnings": warnings,
    }


def mask_touches_border(mask: np.ndarray, margin: int = 2) -> bool:
    """True se a silhueta encosta na borda -> animal provavelmente cortado."""
    if mask is None or not mask.any():
        return False
    m = mask.astype(bool)
    margin = max(1, int(margin))
    return bool(
        m[:margin, :].any()
        or m[-margin:, :].any()
        or m[:, :margin].any()
        or m[:, -margin:].any()
    )


def apply_mask_quality(quality: Dict[str, Any], mask: Optional[np.ndarray]) -> Dict[str, Any]:
    """Acrescenta o teste de enquadramento quando a máscara existe."""
    if mask is not None:
        cut = mask_touches_border(mask)
        quality["mask_touches_border"] = cut
        if cut:
            quality.setdefault("warnings", []).append(
                "O animal parece cortado na borda. Afaste-o ou reenquadre."
            )
    return quality
