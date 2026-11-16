"""Testes de análise de qualidade da imagem."""
import numpy as np
import pytest
import cv2

from app.config import settings
from app.services import image_quality as iq


def _sharp_image():
    """Imagem sintética nítida (quadriculado)."""
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    for i in range(0, 200, 20):
        img[i : i + 10, :, :] = 255
    return img


def _blurry_image():
    """Imagem uniforme (borrada extrema)."""
    return np.full((200, 200, 3), 128, dtype=np.uint8)


def _dark_image():
    return np.full((200, 200, 3), 20, dtype=np.uint8)


def _bright_image():
    return np.full((200, 200, 3), 240, dtype=np.uint8)


def _glare_image():
    img = np.full((200, 200, 3), 128, dtype=np.uint8)
    img[10:110, 10:110, :] = 255  # região estourada > 20%
    return img


def test_analise_nitida_ok():
    # Imagem com padrão de listras escuras/claras (média ~140), nitidez alta,
    # sem estouro nem áreas escuras.
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    for i in range(0, 200, 20):
        img[i : i + 10, :, :] = 100
        if i + 10 < 200:
            img[i + 10 : i + 20, :, :] = 180
    q = iq.analyze_image(img)
    assert q["is_blurry"] is False
    assert q["is_dark"] is False
    assert q["is_overexposed"] is False
    assert q["is_glary"] is False


def test_detecta_borrada():
    img = _blurry_image()
    q = iq.analyze_image(img)
    assert q["is_blurry"] is True
    assert "borrada" in " ".join(q["warnings"]).lower()


def test_detecta_escura():
    img = _dark_image()
    q = iq.analyze_image(img)
    assert q["is_dark"] is True
    assert "escura" in " ".join(q["warnings"]).lower()


def test_detecta_clara_de_mais():
    img = _bright_image()
    q = iq.analyze_image(img)
    assert q["is_overexposed"] is True
    assert "clara" in " ".join(q["warnings"]).lower()


def test_detecta_reflexo_estouro():
    img = _glare_image()
    q = iq.analyze_image(img)
    assert q["is_glary"] is True
    assert "reflexo" in " ".join(q["warnings"]).lower() or "estouro" in " ".join(q["warnings"]).lower()


def test_borda_com_mascara_nao_cortada():
    # Máscara bem dentro da imagem.
    mask = np.zeros((100, 100), dtype=bool)
    mask[10:90, 10:90] = True
    q = iq.analyze_image(np.full((100, 100, 3), 100, dtype=np.uint8))
    q = iq.apply_mask_quality(q, mask)
    assert q["mask_touches_border"] is False


def test_borda_com_mascara_cortada():
    # Máscara encosta na borda esquerda.
    mask = np.zeros((100, 100), dtype=bool)
    mask[10:90, 0:80] = True
    q = iq.analyze_image(np.full((100, 100, 3), 100, dtype=np.uint8))
    q = iq.apply_mask_quality(q, mask)
    assert q["mask_touches_border"] is True
    assert any("cortado" in w.lower() for w in q["warnings"])


def test_decodifica_erro():
    from app.services.storage import decode_image

    with pytest.raises(ValueError, match="imagem válida"):
        decode_image(b"not-an-image")


def test_decode_image():
    from app.services.storage import decode_image

    img = np.zeros((200, 200, 3), dtype=np.uint8)
    img[:, :] = (100, 120, 140)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    decoded = decode_image(buf.tobytes())
    assert decoded.shape == img.shape