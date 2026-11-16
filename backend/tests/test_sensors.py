"""Testes de normalização e validação dos sensores."""
import pytest

from app.config import settings
from app.services.sensors import DEFAULT_SENSOR_PAYLOAD, normalize_sensor_payload


def test_payload_vazio_retorna_default():
    payload, warnings = normalize_sensor_payload(None)
    assert payload["orientation"]["available"] is False
    assert payload["camera"]["available"] is False
    assert payload["depth"]["available"] is False
    # Deve avisar sobre profundidade indisponível.
    assert any("profundidade" in w.lower() for w in warnings)


def test_inclinacao_calculada():
    # alpha=0, beta=30, gamma=40 -> tilt = sqrt(30^2+40^2) = 50 graus
    raw = {
        "orientation": {"available": True, "alpha": 0, "beta": 30, "gamma": 40, "absolute": True}
    }
    payload, _ = normalize_sensor_payload(raw)
    assert payload["orientation"]["tilt_deg"] == pytest.approx(50.0)


def test_aviso_inclinacao_excessiva():
    # Tilt 10 graus > default 5 graus
    raw = {
        "orientation": {"available": True, "beta": 8, "gamma": 6, "alpha": 0, "absolute": True}
    }
    _, warnings = normalize_sensor_payload(raw)
    assert any("inclinado" in w.lower() for w in warnings)


def test_fallback_luz_por_imagem():
    # Sensor de luz indisponível; brilho da imagem = 80 (escuro ~320 lux)
    raw = {"ambient_light": {"available": False}}
    payload, warnings = normalize_sensor_payload(raw, image_brightness=60.0)
    assert payload["ambient_light"]["available"] is False
    assert payload["ambient_light"]["source"] == "image_fallback"
    assert payload["ambient_light"]["lux"] == 240
    assert any("luz" in w.lower() for w in warnings)


def test_zoom_diferente_de_1x():
    raw = {
        "camera": {
            "available": True,
            "zoom": 1.5,
            "settings": {},
            "capabilities": {},
            "image_capture_supported": True,
        }
    }
    _, warnings = normalize_sensor_payload(raw)
    assert any("zoom" in w.lower() for w in warnings)


def test_sensor_score():
    # Sem nenhum sensor: score 0.
    payload, _ = normalize_sensor_payload({})
    assert payload["quality"]["sensor_score"] == 0

    # Com orientação e câmera disponíveis: 20 + 20 = 40
    raw = {
        "orientation": {"available": True},
        "camera": {"available": True},
    }
    payload, _ = normalize_sensor_payload(raw)
    assert payload["quality"]["sensor_score"] == 40

    # Todos disponíveis -> 100 (cap)
    full = {k: {"available": True} for k in DEFAULT_SENSOR_PAYLOAD if isinstance(DEFAULT_SENSOR_PAYLOAD[k], dict)}
    full["quality"] = DEFAULT_SENSOR_PAYLOAD["quality"]
    payload, _ = normalize_sensor_payload(full)
    assert payload["quality"]["sensor_score"] == 100


def test_geoloc_e_depth_preservados():
    raw = {
        "geolocation": {"available": True, "latitude": -23.5, "longitude": -46.6, "accuracy_m": 10, "timestamp": 123},
        "depth": {"available": True, "distance_m": 3.2, "method": "webxr-depth"},
    }
    payload, _ = normalize_sensor_payload(raw)
    assert payload["geolocation"]["latitude"] == -23.5
    assert payload["depth"]["distance_m"] == 3.2
    assert payload["depth"]["method"] == "webxr-depth"