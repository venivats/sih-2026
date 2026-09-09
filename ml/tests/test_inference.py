"""Unit tests for PolarOps ML Inference Pipeline and streaming buffer."""

import pytest

from ml.src.inference import (
    MLInferenceEngine,
    predict_anomaly,
    predict_fuel,
    run_ml_inference,
)


@pytest.fixture
def base_reading():
    return {
        "timestamp": "2026-01-16 10:00:00",
        "station_id": "BHARATI",
        "temperature_c": -25.0,
        "wind_speed_mps": 12.0,
        "humidity_percent": 65.0,
        "power_consumption_kw": 410.0,
        "battery_level_percent": 82.0,
        "fuel_level_percent": 75.0,
        "water_level_percent": 77.0,
        "generator_temperature_c": 75.0,
        "generator_load_percent": 55.0,
        "generator_rpm": 1500,
        "generator_status": "RUNNING",
    }


def test_cold_start_single_reading(base_reading):
    """Verify inference succeeds on first observation with empty buffer."""
    engine = MLInferenceEngine()
    engine.clear_buffers()

    result = engine.run_ml_inference(base_reading)

    # Check contract fields
    assert result["station_id"] == "BHARATI"
    assert result["timestamp"] == "2026-01-16 10:00:00"
    assert isinstance(result["anomaly"], bool)
    assert isinstance(result["anomaly_score"], float)
    assert isinstance(result["predicted_future_fuel_level"], float)
    assert "rule_signals" in result
    assert "threshold_margins" in result
    assert result["model_version"] == "v1.0.0"


def test_sequential_streaming_buffer_updates(base_reading):
    """Verify buffer retains sequential telemetry and calculates rates/rolling statistics."""
    engine = MLInferenceEngine()
    engine.clear_buffers()

    timestamps = [
        "2026-01-16 10:00:00",
        "2026-01-16 10:20:00",
        "2026-01-16 10:40:00",
        "2026-01-16 11:00:00",
    ]
    fuel_levels = [80.0, 79.5, 79.0, 78.5]

    outputs = []
    for ts, fuel in zip(timestamps, fuel_levels):
        r = dict(base_reading)
        r["timestamp"] = ts
        r["fuel_level_percent"] = fuel
        out = engine.run_ml_inference(r)
        outputs.append(out)

    assert len(outputs) == 4
    # Check that consumption rate becomes positive when fuel decreases
    last_output = outputs[-1]
    assert last_output["predicted_fuel_consumption_rate"] > 0.0


def test_module_level_helpers(base_reading):
    """Verify predict_anomaly and predict_fuel shortcuts work correctly."""
    anom_res = predict_anomaly(base_reading)
    assert "anomaly" in anom_res
    assert "anomaly_score" in anom_res

    fuel_res = predict_fuel(base_reading)
    assert "predicted_future_fuel_level" in fuel_res
    assert "current_fuel_level_percent" in fuel_res

    unified_res = run_ml_inference(base_reading)
    assert unified_res["station_id"] == "BHARATI"


def test_extreme_sensor_values():
    """Verify inference handles extreme Antarctic conditions without numerical crashing."""
    extreme_reading = {
        "timestamp": "2026-01-16 12:00:00",
        "station_id": "MAITRI",
        "temperature_c": -65.0,  # Extreme polar cold
        "wind_speed_mps": 45.0,   # Hurricane-force wind (162 km/h)
        "humidity_percent": 98.0,
        "power_consumption_kw": 850.0, # Capacity exceedance
        "battery_level_percent": 15.0, # Critical battery
        "fuel_level_percent": 10.0,    # Critical fuel
        "water_level_percent": 8.0,    # Critical water
        "generator_temperature_c": 102.0, # Overheating
        "generator_load_percent": 98.0,
        "generator_rpm": 1540,
        "generator_status": "RUNNING",
    }
    result = run_ml_inference(extreme_reading)

    assert result["anomaly"] is True
    assert result["rule_signals"]["fuel_critical"] is True
    assert result["rule_signals"]["generator_temp_critical"] is True
    assert result["rule_signals"]["wind_critical"] is True
    assert result["rule_signals"]["battery_critical"] is True
    assert result["rule_signals"]["water_critical"] is True
    assert result["threshold_margins"]["generator_temp_margin_to_critical"] < 0
