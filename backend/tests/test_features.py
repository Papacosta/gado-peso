"""Testes das características extraídas da máscara."""
import numpy as np
import pytest

from app.services.features import MASK_FEATURE_NAMES, extract_mask_features


def rect_mask(x0, x1, y0, y1, w=200, h=100):
    m = np.zeros((h, w), dtype=bool)
    m[y0 : y1 + 1, x0 : x1 + 1] = True
    return m


def test_retangulo_basico():
    # Animal "idealizado": retângulo 100x50 dentro de uma imagem 200x100.
    mask = rect_mask(50, 149, 25, 74)
    feats = extract_mask_features(mask, 200, 100)

    assert feats["length_px"] == 100
    assert feats["body_height_px"] == 50
    assert feats["area_px"] == 100 * 50
    # Retângulo cheio: fill_ratio = 1 e proporção 2:1.
    assert feats["fill_ratio"] == pytest.approx(1.0)
    assert feats["length_height_ratio"] == pytest.approx(2.0)
    # Tórax (região central) = altura total.
    assert feats["thorax_height_px"] == pytest.approx(50)
    assert feats["thorax_height_ratio"] == pytest.approx(1.0)
    # Normalizações pela imagem.
    assert feats["area_norm"] == pytest.approx(0.25)
    assert feats["length_norm"] == pytest.approx(0.5)
    assert feats["body_height_norm"] == pytest.approx(0.5)


def test_mascara_vazia_levanta_erro():
    empty = np.zeros((50, 50), dtype=bool)
    with pytest.raises(ValueError):
        extract_mask_features(empty, 50, 50)
    with pytest.raises(ValueError):
        extract_mask_features(None, 50, 50)


def test_dimensoes_invalidas():
    mask = rect_mask(0, 9, 0, 9)
    with pytest.raises(ValueError):
        extract_mask_features(mask, 0, 0)


def test_todas_as_features_presentes():
    mask = rect_mask(10, 109, 20, 69)
    feats = extract_mask_features(mask, 200, 100)
    for name in MASK_FEATURE_NAMES:
        assert name in feats, f"feature ausente: {name}"
        assert np.isfinite(feats[name])


def test_torax_ignora_cabeca_e_pernas():
    # Corpo largo no centro e "cabeça/pernas" finos nas extremidades:
    # o tórax deve medir o miolo, não o total.
    h, w = 100, 200
    m = np.zeros((h, w), dtype=bool)
    m[10:80, 30:170] = True     # corpo (70 de altura)
    m[0:20, 0:30] = True        # "cabeça"
    m[80:95, 170:200] = True    # "pernas"
    feats = extract_mask_features(m, w, h)
    assert feats["body_height_px"] == 95
    assert feats["thorax_height_px"] == pytest.approx(70)


def test_fill_ratio_menor_com_furo():
    m = rect_mask(50, 149, 25, 74)
    m[40:60, 80:120] = False  # furo no meio
    feats = extract_mask_features(m, 200, 100)
    assert feats["fill_ratio"] < 1.0
    assert feats["area_px"] == 100 * 50 - 20 * 40
