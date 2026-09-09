"""ML Inference Pipeline for PolarOps.

Provides single-point and streaming inference functions for online telemetry processing,
reconstructing identical feature representations used during training.
"""

from collections import deque
from datetime import datetime
import json
import logging
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Union
import numpy as np
import pandas as pd

from .anomaly_detection import AnomalyDetector
from .config import (
    FEATURE_SCHEMA_PATH,
    FUEL_REGRESSOR_MODEL_PATH,
    IFOREST_MODEL_PATH,
    ROLLING_WINDOW_6H,
)
from .feature_engineering import (
    FUEL_REGRESSOR_FEATURES,
    IFOREST_FEATURES,
    build_full_feature_pipeline,
)
from .fuel_prediction import FuelPredictor

logger = logging.getLogger("PolarOps-Inference")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


class MLInferenceEngine:
    """Unified inference engine maintaining per-station historical buffers for streaming telemetry."""

    def __init__(
        self,
        iforest_path: Optional[Union[str, Path]] = None,
        fuel_model_path: Optional[Union[str, Path]] = None,
        schema_path: Optional[Union[str, Path]] = None,
        buffer_size: int = ROLLING_WINDOW_6H + 5,  # Buffer enough history for 6h lags/windows
    ) -> None:
        self.iforest_path = Path(iforest_path) if iforest_path else IFOREST_MODEL_PATH
        self.fuel_model_path = Path(fuel_model_path) if fuel_model_path else FUEL_REGRESSOR_MODEL_PATH
        self.schema_path = Path(schema_path) if schema_path else FEATURE_SCHEMA_PATH

        self.anomaly_detector = AnomalyDetector.load(self.iforest_path)
        self.fuel_predictor = FuelPredictor.load(self.fuel_model_path)

        # Load schema metadata if available
        self.model_version = "v1.0.0"
        if self.schema_path.exists():
            with open(self.schema_path, "r", encoding="utf-8") as f:
                schema = json.load(f)
                self.model_version = schema.get("model_version", "v1.0.0")

        # Per-station rolling buffer of raw records (dicts)
        self.buffer_size = buffer_size
        self._buffers: Dict[str, Deque[Dict[str, Any]]] = {}

    def clear_buffers(self) -> None:
        """Reset historical observation buffers."""
        self._buffers.clear()

    def _prepare_feature_dataframe(
        self,
        reading: Dict[str, Any],
        station_id: str,
    ) -> pd.DataFrame:
        """Append reading to station buffer and compute rolling feature pipeline on buffer.

        Returns DataFrame containing the engineered features for the latest observation.
        """
        if station_id not in self._buffers:
            self._buffers[station_id] = deque(maxlen=self.buffer_size)

        buffer = self._buffers[station_id]
        buffer.append(dict(reading))

        buffer_df = pd.DataFrame(list(buffer))
        buffer_df["timestamp"] = pd.to_datetime(buffer_df["timestamp"])
        buffer_df = buffer_df.sort_values("timestamp").reset_index(drop=True)

        # Apply exact feature engineering pipeline
        df_feat = build_full_feature_pipeline(buffer_df, include_future_target=False)

        # Return row corresponding to the latest incoming reading
        return df_feat.iloc[[-1]]

    def predict_anomaly(
        self,
        reading: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Predict whether single telemetry reading is anomalous.

        Returns:
            Dict with anomaly (bool), anomaly_score (float), and normalized severity.
        """
        station_id = reading.get("station_id", "UNKNOWN")
        feat_df = self._prepare_feature_dataframe(reading, station_id)

        preds, scores = self.anomaly_detector.predict(feat_df)
        is_anomaly = bool(preds[0] == 1)
        raw_score = float(scores[0])

        return {
            "station_id": station_id,
            "anomaly": is_anomaly,
            "anomaly_score": round(raw_score, 4),
            "decision_threshold": self.anomaly_detector.decision_threshold,
        }

    def predict_fuel(
        self,
        reading: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Predict 1-hour future fuel consumption and resulting fuel level."""
        station_id = reading.get("station_id", "UNKNOWN")
        feat_df = self._prepare_feature_dataframe(reading, station_id)

        pred_level = float(self.fuel_predictor.predict(feat_df)[0])
        pred_consumption = float(self.fuel_predictor.predict_consumption(feat_df)[0])
        consumption_rate = float(feat_df["fuel_consumption_rate"].iloc[0])

        return {
            "station_id": station_id,
            "current_fuel_level_percent": float(reading.get("fuel_level_percent", 0.0)),
            "predicted_future_fuel_level": round(pred_level, 2),
            "predicted_fuel_consumption_percent": round(pred_consumption, 2),
            "current_fuel_consumption_rate": round(consumption_rate, 4),
            "forecast_horizon": "1 hour",
        }

    def run_ml_inference(
        self,
        reading: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Unified ML inference entry point matching Alert Engine integration contract.

        Args:
            reading: Dict of raw sensor telemetry with at least:
                timestamp, station_id, temperature_c, wind_speed_mps, humidity_percent,
                power_consumption_kw, battery_level_percent, fuel_level_percent,
                water_level_percent, generator_temperature_c, generator_load_percent,
                generator_rpm, generator_status.

        Returns:
            Comprehensive structured prediction object ready for Alert Engine ingestion.
        """
        station_id = str(reading.get("station_id", "UNKNOWN"))
        feat_df = self._prepare_feature_dataframe(reading, station_id)

        # Anomaly Detection
        preds, scores = self.anomaly_detector.predict(feat_df)
        is_anomaly = bool(preds[0] == 1)
        anomaly_score = float(scores[0])

        # Fuel Forecasting
        pred_level = float(self.fuel_predictor.predict(feat_df)[0])
        pred_consumption = float(self.fuel_predictor.predict_consumption(feat_df)[0])
        consumption_rate = float(feat_df["fuel_consumption_rate"].iloc[0])

        # Extract Rule Signal Features from row
        rule_signals = {
            "fuel_warning": bool(feat_df["fuel_warning_flag"].iloc[0] == 1),
            "fuel_critical": bool(feat_df["fuel_critical_flag"].iloc[0] == 1),
            "battery_warning": bool(feat_df["battery_warning_flag"].iloc[0] == 1),
            "battery_critical": bool(feat_df["battery_critical_flag"].iloc[0] == 1),
            "water_warning": bool(feat_df["water_warning_flag"].iloc[0] == 1),
            "water_critical": bool(feat_df["water_critical_flag"].iloc[0] == 1),
            "generator_temp_warning": bool(feat_df["generator_temp_warning_flag"].iloc[0] == 1),
            "generator_temp_critical": bool(feat_df["generator_temp_critical_flag"].iloc[0] == 1),
            "wind_warning": bool(feat_df["wind_warning_flag"].iloc[0] == 1),
            "wind_critical": bool(feat_df["wind_critical_flag"].iloc[0] == 1),
            "power_warning": bool(feat_df["power_warning_flag"].iloc[0] == 1),
            "power_critical": bool(feat_df["power_critical_flag"].iloc[0] == 1),
            "generator_degraded": bool(feat_df["generator_degraded_flag"].iloc[0] == 1),
            "generator_consistency_alert": bool(
                (feat_df["generator_high_temp_high_load"].iloc[0] == 1)
                or (feat_df["generator_off_high_load"].iloc[0] == 1)
            ),
        }

        margins = {
            "fuel_margin_to_critical": round(float(feat_df["fuel_margin_to_critical"].iloc[0]), 2),
            "generator_temp_margin_to_critical": round(float(feat_df["generator_temp_margin_to_critical"].iloc[0]), 2),
            "power_margin_to_critical": round(float(feat_df["power_margin_to_critical"].iloc[0]), 2),
            "wind_margin_to_critical": round(float(feat_df["wind_margin_to_critical"].iloc[0]), 2),
        }

        timestamp_str = str(reading.get("timestamp", datetime.now().isoformat()))

        output = {
            "station_id": station_id,
            "timestamp": timestamp_str,
            "anomaly": is_anomaly,
            "anomaly_score": round(anomaly_score, 4),
            "predicted_fuel_consumption_rate": round(consumption_rate, 4),
            "predicted_future_fuel_level": round(pred_level, 2),
            "predicted_1h_fuel_consumption": round(pred_consumption, 2),
            "rule_signals": rule_signals,
            "threshold_margins": margins,
            "model_version": self.model_version,
        }
        return output


# Global instance for quick module-level access
_engine_instance: Optional[MLInferenceEngine] = None


def get_inference_engine() -> MLInferenceEngine:
    """Return singleton instance of MLInferenceEngine."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = MLInferenceEngine()
    return _engine_instance


def predict_anomaly(reading: Dict[str, Any]) -> Dict[str, Any]:
    """Module-level function to predict anomaly for a reading."""
    return get_inference_engine().predict_anomaly(reading)


def predict_fuel(reading: Dict[str, Any]) -> Dict[str, Any]:
    """Module-level function to predict fuel consumption for a reading."""
    return get_inference_engine().predict_fuel(reading)


def run_ml_inference(reading: Dict[str, Any]) -> Dict[str, Any]:
    """Module-level unified inference function."""
    return get_inference_engine().run_ml_inference(reading)
