"""Testes das métricas de avaliação."""
import pytest

from app.services.metrics import (
    bias,
    fold_metrics,
    interval_half_width,
    mae,
    mape,
    rmse,
    summarize,
)


def test_mae():
    # errors: 10, 10, 30 -> mean = 16.666...
    assert mae([100, 200, 300], [110, 190, 330]) == pytest.approx(16.6666667)


def test_mape():
    # Erros de 10% em cada caso.
    assert mape([100, 200], [110, 180]) == pytest.approx(10.0)


def test_mape_ignora_zero():
    y = [0.0, 100.0]
    p = [50.0, 110.0]
    assert mape(y, p) == pytest.approx(10.0)  # só considera o peso 100


def test_rmse_e_bias():
    y_true = [100.0, 100.0]
    y_pred = [110.0, 120.0]
    # sqrt((100 + 400)/2) = sqrt(250) ≈ 15.811
    assert rmse(y_true, y_pred) == pytest.approx(15.811388)
    assert bias(y_true, y_pred) == pytest.approx(15.0)  # chuta para cima


def test_listas_invalidas():
    with pytest.raises(ValueError):
        mae([], [])
    with pytest.raises(ValueError):
        mae([1, 2, 3], [1, 2])


def test_summarize():
    summary = summarize([100, 200], [110, 190])
    assert summary["n"] == 2
    assert summary["mae_kg"] == pytest.approx(10.0)
    assert "mape_pct" in summary and "rmse_kg" in summary and "bias_kg" in summary


def test_interval_meia_largura():
    assert interval_half_width(20.0, z=1.28) == pytest.approx(25.6, abs=0.1)
    with pytest.raises(ValueError):
        interval_half_width(-1.0)


def test_fold_metrics():
    folds = fold_metrics([[100, 200]], [[110, 190]])
    assert len(folds) == 1
    assert folds[0]["fold"] == 1
    assert folds[0]["mae_kg"] == pytest.approx(10.0)
