"""Métricas de avaliação do estimador (funções puras, sem dependências)."""
from __future__ import annotations

import statistics
from typing import Dict, List, Sequence


def mae(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    """Erro absoluto médio em kg."""
    if not y_true or len(y_true) != len(y_pred):
        raise ValueError("Listas de valores reais/previstos vazias ou de tamanhos diferentes.")
    return statistics.fmean(abs(t - p) for t, p in zip(y_true, y_pred))


def mape(y_true: Sequence[float], y_pred: Sequence[float], epsilon: float = 1e-9) -> float:
    """Erro percentual absoluto médio (%), ignorando valores reais ~0."""
    if not y_true or len(y_true) != len(y_pred):
        raise ValueError("Listas de valores reais/previstos vazias ou de tamanhos diferentes.")
    return statistics.fmean(
        abs((t - p) / max(abs(t), epsilon)) * 100.0
        for t, p in zip(y_true, y_pred)
        if abs(t) > epsilon
    )


def rmse(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    """Raiz do erro quadrático médio (kg)."""
    if not y_true or len(y_true) != len(y_pred):
        raise ValueError("Listas de valores reais/previstos vazias ou de tamanhos diferentes.")
    return statistics.fmean((t - p) ** 2 for t, p in zip(y_true, y_pred)) ** 0.5


def bias(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    """Viés médio (positivo = modelo chuta para cima)."""
    if not y_true or len(y_true) != len(y_pred):
        raise ValueError("Listas de valores reais/previstos vazias ou de tamanhos diferentes.")
    return statistics.fmean(p - t for t, p in zip(y_true, y_pred))


def summarize(y_true: Sequence[float], y_pred: Sequence[float]) -> Dict[str, float]:
    """Resumo completo das métricas de uma validação."""
    if not y_true:
        raise ValueError("Nada para avaliar: lista vazia.")
    return {
        "n": len(y_true),
        "mae_kg": round(mae(y_true, y_pred), 3),
        "mape_pct": round(mape(y_true, y_pred), 3),
        "rmse_kg": round(rmse(y_true, y_pred), 3),
        "bias_kg": round(bias(y_true, y_pred), 3),
    }


def interval_half_width(mae_kg: float, z: float = 1.28) -> float:
    """Meia-largura da faixa de incerteza.

    z = 1.28 dá uma faixa ~80% quando os erros são aproximadamente normais:
    peso_estimado ± essa faixa. Baseada no MAE da validação cruzada.
    """
    if mae_kg < 0:
        raise ValueError("MAE não pode ser negativo.")
    return round(z * mae_kg, 1)


def fold_metrics(
    y_true_by_fold: List[Sequence[float]],
    y_pred_by_fold: List[Sequence[float]],
) -> List[Dict[str, float]]:
    """Métricas por fold da validação cruzada (para relatório honesto)."""
    out: List[Dict[str, float]] = []
    for i, (yt, yp) in enumerate(zip(y_true_by_fold, y_pred_by_fold), start=1):
        row = {"fold": i, **summarize(yt, yp)}
        out.append(row)
    return out
