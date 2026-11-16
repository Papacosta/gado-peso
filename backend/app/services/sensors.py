"""Normalização e validação dos sensores do celular (Fase 1, item obrigatório).

O frontend envia um payload JSON com todos os sensores que conseguiu ler.
Esta camada:
- Garante que **todas as chaves existam** (preenche com `available: false` e
  `value: null` quando o sensor não existe).
- Calcula métricas derivadas (inclinação absoluta em graus, brilho da imagem
  como fallback do sensor de luz, etc.).
- Gera avisos de qualidade (inclinação excessiva, luz baixa, falta de sensor
  de profundidade, etc.) que ficam salvos no banco junto com a foto.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Tuple

from ..config import settings


# ---------------------------------------------------------------------------
# Estrutura padrão do payload que o backend aceita/salva
# ---------------------------------------------------------------------------
DEFAULT_SENSOR_PAYLOAD = {
    "orientation": {
        "available": False,
        "alpha": None,
        "beta": None,
        "gamma": None,
        "absolute": None,
        "tilt_deg": None,
    },
    "motion": {
        "available": False,
        "acceleration": {"x": None, "y": None, "z": None},
        "acceleration_including_gravity": {"x": None, "y": None, "z": None},
        "rotation_rate": {"alpha": None, "beta": None, "gamma": None},
    },
    "camera": {
        "available": False,
        "settings": {},
        "capabilities": {},
        "zoom": None,
        "image_capture_supported": False,
    },
    "geolocation": {
        "available": False,
        "latitude": None,
        "longitude": None,
        "accuracy_m": None,
        "timestamp": None,
    },
    "ambient_light": {
        "available": False,
        "lux": None,
        "source": "image_fallback",  # 'sensor' | 'image_fallback'
    },
    "depth": {
        "available": False,
        "distance_m": None,
        "method": None,
    },
    "device": {
        "user_agent": None,
        "platform": None,
    },
    "quality": {
        "warnings": [],
        "sensor_score": 100,  # 0-100: ponderação grosseira de disponibilidade
    },
}


def _deep_merge(base: Dict, incoming: Dict) -> Dict:
    """Mescla dicionários recursivamente, mantendo chaves ausentes do incoming."""
    result = dict(base)
    for k, v in incoming.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


def _compute_tilt_deg(alpha: float | None, beta: float | None, gamma: float | None) -> float | None:
    """Inclinação absoluta (graus) aproximada pela norma do vetor (beta, gamma).

    alpha = rotação em Z (bússola); beta = inclinação frontal (+frente/-trás);
    gamma = inclinação lateral (+esquerda/-direita). A inclinação total do
    dispositivo em relação à gravidade é a norma 2D de beta/gamma.
    """
    if beta is None and gamma is None:
        return None
    b = beta if beta is not None else 0.0
    g = gamma if gamma is not None else 0.0
    return round(math.degrees(math.hypot(math.radians(b), math.radians(g))), 2)


def _sensor_score(payload: Dict[str, Any]) -> int:
    """Score grosseiro de disponibilidade de sensores (0-100)."""
    weights = {
        "orientation": 20,
        "motion": 10,
        "camera": 20,
        "geolocation": 10,
        "ambient_light": 15,
        "depth": 25,
    }
    total = sum(w for k, w in weights.items() if payload.get(k, {}).get("available"))
    return min(total, 100)


def _generate_warnings(payload: Dict[str, Any], image_brightness: float | None) -> List[str]:
    """Avisos baseados nos sensores e na imagem."""
    warnings: List[str] = []

    # Inclinação
    tilt = payload.get("orientation", {}).get("tilt_deg")
    if tilt is not None and tilt > settings.max_tilt_deg:
        warnings.append(
            f"Celular inclinado {tilt:.1f}° (máx. {settings.max_tilt_deg}°). "
            "Endireite o tripé antes de fotografar."
        )

    # Luz ambiente (sensor real ou fallback da imagem)
    luminosity = payload.get("ambient_light", {})
    lux = luminosity.get("lux")
    if lux is not None and lux < 300:
        warnings.append("Ambiente com pouca luz (< 300 lux). Prefira horário de sol pleno.")

    # Profundidade
    if not payload.get("depth", {}).get("available"):
        warnings.append(
            "Sensor de profundidade indisponível. A distância até o animal "
            "não será registrada (não bloqueia a coleta)."
        )

    # Zoom
    zoom = payload.get("camera", {}).get("zoom")
    if zoom is not None and zoom != 1.0:
        warnings.append(f"Zoom detectado ({zoom:.2f}x). Use zoom 1x (sem zoom digital/óptico).")

    return warnings


def normalize_sensor_payload(
    raw: Dict[str, Any] | None,
    image_brightness: float | None = None,
) -> Tuple[Dict[str, Any], List[str]]:
    """Normaliza, calcula derivados e retorna (payload_completo, warnings).

    - `raw`: payload enviado pelo frontend (pode estar incompleto).
    - `image_brightness`: brilho médio da imagem (0-255) para fallback de luz.
    """
    payload = _deep_merge(DEFAULT_SENSOR_PAYLOAD, raw or {})

    # Fallback de luz: usa o brilho médio da imagem quando não há sensor.
    ambient = payload["ambient_light"]
    if not ambient.get("available") and image_brightness is not None:
        ambient["lux"] = round(image_brightness * 4.0)  # regra de bolso grosseira
        ambient["source"] = "image_fallback"

    # Derivados
    ori = payload["orientation"]
    ori["tilt_deg"] = _compute_tilt_deg(ori.get("alpha"), ori.get("beta"), ori.get("gamma"))

    # Score e avisos
    payload["quality"]["sensor_score"] = _sensor_score(payload)
    warnings = _generate_warnings(payload, image_brightness)
    payload["quality"]["warnings"] = warnings

    return payload, warnings