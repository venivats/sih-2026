"""Unit tests for Isolation Forest Anomaly Detection."""

from pathlib import Path
import numpy as np
import pandas as pd
import pytest

from ml.src.anomaly_detection import AnomalyDetector
from ml.src.data_loader import load_and_validate_telemetry
from ml.src.feature_engineering import IFOREST_FEATURES, build_full_feature_pipeline


@pytest.fixture(scope="module")
def prepared_telemetry_df() -> pd.DataFrame:
    df, _ = load_and_validate_telemetry()
    return build_full_feature_pipeline(df, include_future_target=False)


def test_detector_safety_check():
    """Verify AnomalyDetector rejects initialization if 'anomaly' is in feature list."""
    with pytest.raises(ValueError, match="CRITICAL: 'anomaly' target column found"):
        AnomalyDetector(features=["temperature_c", "anomaly"])


def test_detector_fit_and_predict(prepared_telemetry_df):
    """Verify Isolation Forest training, output shapes, and prediction types."""
    detector = AnomalyDetector(features=IFOREST_FEATURES, n_estimators=50, contamination=0.01)
    detector.fit(prepared_telemetry_df.iloc[:500])

    preds, scores = detector.predict(prepared_telemetry_df.iloc[500:600])

    assert len(preds) == 100
    assert len(scores) == 100
    assert set(np.unique(preds)).issubset({0, 1})
    assert scores.dtype == np.float64


def test_model_save_and_load_roundtrip(prepared_telemetry_df, tmp_path: Path):
    """Verify model artifact serialization and deserialization reproducibility."""
    save_path = tmp_path / "test_iforest.joblib"
    detector = AnomalyDetector(features=IFOREST_FEATURES, n_estimators=50, contamination=0.01)
    detector.fit(prepared_telemetry_df.iloc[:200])
    detector.decision_threshold = 0.035
    detector.save(save_path)

    loaded = AnomalyDetector.load(save_path)
    assert loaded.is_fitted
    assert loaded.decision_threshold == 0.035
    assert loaded.features == IFOREST_FEATURES

    p1, s1 = detector.predict(prepared_telemetry_df.iloc[200:250])
    p2, s2 = loaded.predict(prepared_telemetry_df.iloc[200:250])

    np.testing.assert_array_equal(p1, p2)
    np.testing.assert_allclose(s1, s2, atol=1e-6)
