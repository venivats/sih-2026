"""Unit tests for PolarOps Feature Engineering and Rule-Based Features."""

import numpy as np
import pandas as pd
import pytest

from ml.src.config import (
    BATTERY_CRITICAL_THRESHOLD_PERCENT,
    BATTERY_WARNING_THRESHOLD_PERCENT,
    FUEL_CRITICAL_THRESHOLD_PERCENT,
    FUEL_WARNING_THRESHOLD_PERCENT,
    GENERATOR_TEMP_CRITICAL_THRESHOLD_C,
    GENERATOR_TEMP_WARNING_THRESHOLD_C,
    WIND_SPEED_CRITICAL_THRESHOLD_KMH,
    WIND_SPEED_WARNING_THRESHOLD_KMH,
)
from ml.src.feature_engineering import (
    FUEL_REGRESSOR_FEATURES,
    IFOREST_FEATURES,
    add_station_encoding,
    add_stationwise_deltas_and_rates,
    add_stationwise_lag_features,
    add_stationwise_rolling_features,
    add_temporal_features,
    build_full_feature_pipeline,
    create_future_fuel_targets,
)
from ml.src.rule_features import compute_rule_features


@pytest.fixture
def synthetic_sample_df() -> pd.DataFrame:
    """Create controlled 2-station dataset for testing."""
    times = pd.date_range("2026-01-01 00:00:00", periods=10, freq="20min")
    data_maitri = {
        "timestamp": times,
        "station_id": "MAITRI",
        "temperature_c": np.linspace(-20.0, -30.0, 10),
        "wind_speed_mps": [10.0] * 10,
        "humidity_percent": [60.0] * 10,
        "power_consumption_kw": [400.0] * 10,
        "battery_level_percent": np.linspace(90.0, 70.0, 10),
        "fuel_level_percent": np.linspace(80.0, 60.0, 10),
        "water_level_percent": [75.0] * 10,
        "generator_temperature_c": np.linspace(70.0, 85.0, 10),
        "generator_load_percent": [55.0] * 10,
        "generator_rpm": [1500] * 10,
        "generator_status": ["RUNNING"] * 9 + ["STANDBY"],
        "anomaly": [0] * 9 + [1],
    }
    data_bharati = {
        "timestamp": times,
        "station_id": "BHARATI",
        "temperature_c": np.linspace(-15.0, -25.0, 10),
        "wind_speed_mps": [15.0] * 10,
        "humidity_percent": [70.0] * 10,
        "power_consumption_kw": [500.0] * 10,
        "battery_level_percent": np.linspace(85.0, 65.0, 10),
        "fuel_level_percent": np.linspace(90.0, 70.0, 10),
        "water_level_percent": [80.0] * 10,
        "generator_temperature_c": np.linspace(72.0, 92.0, 10),
        "generator_load_percent": [60.0] * 10,
        "generator_rpm": [1495] * 10,
        "generator_status": ["RUNNING"] * 10,
        "anomaly": [0] * 10,
    }
    df = pd.concat([pd.DataFrame(data_maitri), pd.DataFrame(data_bharati)], axis=0)
    return df.sort_values(["station_id", "timestamp"]).reset_index(drop=True)


def test_rule_features_threshold_boundaries(synthetic_sample_df):
    """Test that rule-based flags accurately identify threshold breaches."""
    res = compute_rule_features(synthetic_sample_df)

    # Wind speed conversion: 10 m/s * 3.6 = 36 km/h (normal); 20 m/s * 3.6 = 72 km/h (warning)
    assert np.allclose(res["wind_speed_kmh"], res["wind_speed_mps"] * 3.6)

    # Fuel thresholds
    test_cases = pd.DataFrame({
        "station_id": ["MAITRI", "MAITRI", "MAITRI"],
        "temperature_c": [-20.0, -20.0, -20.0],
        "wind_speed_mps": [5.0, 5.0, 5.0],
        "humidity_percent": [50.0, 50.0, 50.0],
        "power_consumption_kw": [300.0, 300.0, 300.0],
        "battery_level_percent": [50.0, 35.0, 15.0],
        "fuel_level_percent": [50.0, 25.0, 10.0],  # normal, warning (<30), critical (<15)
        "water_level_percent": [50.0, 25.0, 5.0],   # normal, warning (<30), critical (<10)
        "generator_temperature_c": [75.0, 85.0, 95.0], # normal, warning (>80), critical (>90)
        "generator_load_percent": [50.0, 80.0, 85.0],
        "generator_rpm": [1500, 1500, 1500],
        "generator_status": ["RUNNING", "STANDBY", "OFF"],
    })
    out = compute_rule_features(test_cases)

    # Fuel checks
    assert out["fuel_warning_flag"].tolist() == [0, 1, 1]
    assert out["fuel_critical_flag"].tolist() == [0, 0, 1]
    assert out["fuel_margin_to_critical"].iloc[2] == 10.0 - FUEL_CRITICAL_THRESHOLD_PERCENT  # -5.0

    # Generator Temp checks
    assert out["generator_temp_warning_flag"].tolist() == [0, 1, 1]
    assert out["generator_temp_critical_flag"].tolist() == [0, 0, 1]
    # Margin sign convention: 90 - temp
    assert out["generator_temp_margin_to_critical"].iloc[2] == 90.0 - 95.0  # -5.0

    # Battery checks
    assert out["battery_warning_flag"].tolist() == [0, 1, 1]
    assert out["battery_critical_flag"].tolist() == [0, 0, 1]

    # Water checks
    assert out["water_warning_flag"].tolist() == [0, 1, 1]
    assert out["water_critical_flag"].tolist() == [0, 0, 1]


def test_station_isolation_no_cross_boundary_leakage(synthetic_sample_df):
    """Verify that delta and lag calculations do NOT leap between BHARATI and MAITRI."""
    out = add_stationwise_deltas_and_rates(synthetic_sample_df)

    # The first row of MAITRI and the first row of BHARATI must have zero or initial delta
    maitri_first_idx = out[out["station_id"] == "MAITRI"].index[0]
    bharati_first_idx = out[out["station_id"] == "BHARATI"].index[0]

    assert out.loc[maitri_first_idx, "fuel_delta"] == 0.0
    assert out.loc[bharati_first_idx, "fuel_delta"] == 0.0

    # Intermediate deltas within each station should be negative (decreasing fuel)
    assert out.loc[maitri_first_idx + 1, "fuel_delta"] < 0.0
    assert out.loc[bharati_first_idx + 1, "fuel_delta"] < 0.0


def test_anomaly_not_in_features():
    """CRITICAL TEST: Verify anomaly label is NEVER included in feature sets."""
    assert "anomaly" not in IFOREST_FEATURES, "CRITICAL ERROR: 'anomaly' present in IFOREST_FEATURES!"
    assert "anomaly" not in FUEL_REGRESSOR_FEATURES, "CRITICAL ERROR: 'anomaly' present in FUEL_REGRESSOR_FEATURES!"


def test_future_fuel_target_forward_shift(synthetic_sample_df):
    """Verify future target creation does not leak future information to past."""
    horizon = 2
    out = create_future_fuel_targets(synthetic_sample_df, horizon_steps=horizon)

    for st in ["MAITRI", "BHARATI"]:
        sub = out[out["station_id"] == st].reset_index(drop=True)
        # Check that row 0's future target matches row 2's current fuel
        assert sub.loc[0, "target_future_fuel_level"] == sub.loc[horizon, "fuel_level_percent"]
        # Check that last 2 rows are NaN (no future observations exist)
        assert pd.isna(sub.loc[len(sub) - 1, "target_future_fuel_level"])
        assert pd.isna(sub.loc[len(sub) - 2, "target_future_fuel_level"])


def test_full_pipeline_execution(synthetic_sample_df):
    """Verify end-to-end feature pipeline produces clean output without NaNs."""
    df_feat = build_full_feature_pipeline(synthetic_sample_df, include_future_target=False)

    for col in IFOREST_FEATURES:
        assert col in df_feat.columns, f"Missing feature: {col}"
        assert not df_feat[col].isnull().any(), f"NaN in feature: {col}"
        assert not np.isinf(df_feat[col]).any(), f"Inf in feature: {col}"
