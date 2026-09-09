"""Unit tests for PolarOps Fuel Prediction Model."""

from pathlib import Path
import numpy as np
import pandas as pd
import pytest

from ml.src.data_loader import load_and_validate_telemetry
from ml.src.evaluation import create_chronological_station_splits
from ml.src.feature_engineering import FUEL_REGRESSOR_FEATURES, build_full_feature_pipeline
from ml.src.fuel_prediction import FuelPredictor


@pytest.fixture(scope="module")
def prepared_splits():
    df, _ = load_and_validate_telemetry()
    df_feat = build_full_feature_pipeline(df, include_future_target=True)
    return create_chronological_station_splits(df_feat)


def test_fuel_predictor_safety_checks():
    """Verify FuelPredictor rejects initialization if target or anomaly is in feature list."""
    with pytest.raises(ValueError, match="CRITICAL: Target column or anomaly label detected"):
        FuelPredictor(features=["power_consumption_kw", "target_future_fuel_consumption"])

    with pytest.raises(ValueError, match="CRITICAL: Target column or anomaly label detected"):
        FuelPredictor(features=["power_consumption_kw", "anomaly"])


def test_fuel_predictor_fit_and_predict(prepared_splits):
    """Verify training, consumption prediction, and fuel level prediction."""
    train_df, val_df, _ = prepared_splits

    predictor = FuelPredictor(
        features=FUEL_REGRESSOR_FEATURES,
        n_estimators=50,
        max_depth=6,
        random_state=42,
    )
    predictor.fit(train_df)

    pred_consumption = predictor.predict_consumption(val_df)
    pred_level = predictor.predict(val_df)

    assert len(pred_consumption) == len(val_df)
    assert len(pred_level) == len(val_df)
    assert not np.isnan(pred_consumption).any()
    assert not np.isnan(pred_level).any()

    # Reconstructed level must equal current - consumption (clipped to [0, 100])
    expected_level = np.clip(val_df["fuel_level_percent"].values - pred_consumption, 0.0, 100.0)
    np.testing.assert_allclose(pred_level, expected_level, atol=1e-5)


def test_fuel_predictor_baseline_evaluation(prepared_splits):
    """Verify evaluation against persistence baseline produces expected metrics."""
    train_df, _, test_df = prepared_splits

    predictor = FuelPredictor(
        features=FUEL_REGRESSOR_FEATURES,
        n_estimators=50,
        max_depth=6,
        random_state=42,
    )
    predictor.fit(train_df)

    eval_results = predictor.evaluate_with_baseline(test_df)
    assert "model_mae" in eval_results
    assert "baseline_mae" in eval_results
    assert "mae_improvement_percent" in eval_results
    assert eval_results["model_mae"] > 0
    assert eval_results["baseline_mae"] > 0


def test_fuel_predictor_save_and_load_roundtrip(prepared_splits, tmp_path: Path):
    """Verify serialization and deserialization reproducibility."""
    train_df, val_df, _ = prepared_splits
    save_path = tmp_path / "test_fuel_rf.joblib"

    predictor = FuelPredictor(
        features=FUEL_REGRESSOR_FEATURES,
        n_estimators=30,
        max_depth=5,
        random_state=42,
    )
    predictor.fit(train_df)
    predictor.save(save_path)

    loaded = FuelPredictor.load(save_path)
    assert loaded.is_fitted
    assert loaded.features == FUEL_REGRESSOR_FEATURES

    p1 = predictor.predict(val_df.iloc[:50])
    p2 = loaded.predict(val_df.iloc[:50])
    np.testing.assert_allclose(p1, p2, atol=1e-6)
