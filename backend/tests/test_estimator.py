"""Testes do estimador (Fase 2) com dataset sintético."""
import numpy as np
import pytest

from app.services.estimator import (
    FEATURE_NAMES,
    NUMERIC_FEATURES,
    RidgeWeightEstimator,
    GradientBoostingWeightEstimator,
    build_feature_row,
    create_estimator,
    format_interval,
)
from app.services.features import MASK_FEATURE_NAMES

RNG = np.random.default_rng(42)


def synthetic_dataset(n_animals=25, photos_per_animal=4):
    """Peso 'real' sintético: correlacionado com features da máscara.

    O mesmo animal tem várias fotos (grupo), como no app real. O valor vereiro
    é determinado pelo animal; as features variam um pouco por foto.
    """
    rows, y, groups = [], [], []
    for g in range(n_animals):
        animal_size = RNG.uniform(0.6, 1.4)  # "tamanho" fixo do animal
        weight = 120.0 + 260.0 * animal_size + RNG.uniform(-5, 5)
        for _ in range(photos_per_animal):
            row = {
                "area_norm": animal_size**2 * RNG.uniform(0.95, 1.05),
                "length_norm": animal_size * RNG.uniform(0.95, 1.05),
                "body_height_norm": animal_size * RNG.uniform(0.95, 1.05),
                "thorax_height_norm": animal_size * 0.7 * RNG.uniform(0.95, 1.05),
                "length_height_ratio": 2.0 + RNG.uniform(-0.1, 0.1),
                "thorax_height_ratio": 0.7 + RNG.uniform(-0.05, 0.05),
                "fill_ratio": 0.6 + RNG.uniform(-0.05, 0.05),
                "area_per_length": animal_size * 0.6 * RNG.uniform(0.95, 1.05),
                "centroid_x": 0.5,
                "centroid_y": 0.5,
                "tilt_deg": RNG.uniform(0, 3),
                "distance_cm": 450.0,
                "camera_height_cm": 90.0,
                "age_months": 24,
                "bcs": 5.0,
                "breed": "nelore" if g % 2 == 0 else "angus",
                "sex": "macho" if g % 3 == 0 else "femea",
                "category": "vaca" if g % 2 == 0 else "boi",
            }
            rows.append(row)
            y.append(weight)
            groups.append(f"animal-{g}")
    return rows, y, groups


def test_build_feature_row_mapeia_tudo():
    row = build_feature_row(
        {name: 1.0 for name in MASK_FEATURE_NAMES},
        sensors={"orientation": {"tilt_deg": 2.0}},
        animal={"breed": "Nelore", "sex": "MACHO", "category": "vaca", "age_months": 30, "bcs": 5.0},
        capture_point={"distance_cm": 400, "camera_height_cm": 85},
    )
    assert row["tilt_deg"] == 2.0
    assert row["distance_cm"] == 400
    assert row["breed"] == "nelore"      # normalizado minúsculo
    assert row["sex"] == "macho"
    assert all(name in row for name in MASK_FEATURE_NAMES)


def test_encoder_imputa_ausentes():
    rows = [{"x": 1.0}, {"x": 3.0}, {"x": None}]
    from app.services.estimator import FeatureEncoder

    # Como NUMERIC_FEATURES são fixos, use-ás como nomes reais:
    rows = []
    for base in synthetic_dataset(2, 2)[0]:
        r = dict(base)
        del r["bcs"]           # ausente -> mediana
        rows.append(r)
    enc = FeatureEncoder().fit(rows)
    X = enc.transform(rows)
    assert X.shape[1] == enc.output_dim
    # Coluna de bcs: todos os valores = mediana (0.0 pois todos ausentes no fit)
    bcs_idx = NUMERIC_FEATURES.index("bcs")
    assert np.allclose(X[:, bcs_idx], enc.medians["bcs"])


def test_ridge_cross_validation_por_animal():
    rows, y, groups = synthetic_dataset()
    est = RidgeWeightEstimator(alpha=1.0)
    metrics = est.cross_validate(rows, y, groups, max_splits=5)

    assert metrics["grouping"] == "animal"
    assert metrics["n_folds"] == 5
    assert len(metrics["folds"]) == 5
    # Dataset sintético é quase determinístico -> MAE pequeno.
    assert metrics["mae_kg"] < 15.0
    assert metrics["interval_half_width_kg"] > 0
    assert metrics["mape_pct"] < 6.0
    assert len(metrics["predicted_vs_real"]) == len(y)


def test_ridge_fit_predict_e_roundtrip(tmp_path):
    rows, y, groups = synthetic_dataset()
    est = RidgeWeightEstimator()
    est.cross_validate(rows, y, groups)
    est.fit(rows, y)
    preds = est.predict(rows[:5])
    assert len(preds) == 5

    path = str(tmp_path / "model.joblib")
    est.save(path)
    loaded = RidgeWeightEstimator.load(path)
    np.testing.assert_allclose(loaded.predict(rows[:5]), preds, rtol=1e-6)


def test_gboost_treina():
    rows, y, groups = synthetic_dataset(12, 3)
    est = GradientBoostingWeightEstimator()
    metrics = est.cross_validate(rows, y, groups, max_splits=4)
    assert metrics["mae_kg"] < 40.0  # dataset pequeno, mas aprende algo


def test_nao_e_possivel_cv_com_poucos_animais():
    rows, y, groups = synthetic_dataset(2, 2)
    est = RidgeWeightEstimator()
    with pytest.raises(ValueError, match="animais"):
        est.cross_validate(rows, y, groups)


def test_predict_sem_treinar_levanta():
    est = RidgeWeightEstimator()
    with pytest.raises(RuntimeError, match="treinado"):
        est.predict([{name: 0.0 for name in FEATURE_NAMES}])


def test_create_estimator_invalido():
    with pytest.raises(ValueError, match="Algoritmo"):
        create_estimator("xgboost")


def test_format_interval():
    w, lo, hi = format_interval(412.04, 24.56)
    assert w == 412.0
    assert lo == 387.4
    assert hi == 436.6
