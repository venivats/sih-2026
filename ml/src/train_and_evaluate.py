"""End-to-End Model Training, Calibration, Evaluation, and Serialization for PolarOps."""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict
import numpy as np

from .anomaly_detection import AnomalyDetector
from .config import (
    FEATURE_SCHEMA_PATH,
    FUEL_REGRESSOR_MODEL_PATH,
    IFOREST_MODEL_PATH,
    MODELS_DIR,
    RF_FORECAST_HORIZON_STEPS,
    STATION_POWER_CAPACITY_KW,
)
from .data_loader import load_and_validate_telemetry
from .evaluation import (
    create_chronological_station_splits,
    evaluate_anomaly_detector,
    evaluate_fuel_regressor,
)
from .feature_engineering import (
    FUEL_REGRESSOR_FEATURES,
    IFOREST_FEATURES,
    RAW_SENSOR_FEATURES,
    build_full_feature_pipeline,
)
from .fuel_prediction import FuelPredictor

logger = logging.getLogger("PolarOps-Trainer")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


def train_and_evaluate_all() -> Dict[str, Any]:
    """Execute complete training, calibration, evaluation, and artifact saving pipeline."""
    logger.info("Starting PolarOps ML Training and Evaluation Pipeline...")

    # 1. Load and validate raw telemetry
    df_raw, val_report = load_and_validate_telemetry()

    # 2. Build feature pipeline
    logger.info("Computing rule features, temporal features, deltas, rates, and rolling statistics...")
    df_features = build_full_feature_pipeline(df_raw, include_future_target=True)

    # 3. Create chronological train / val / test splits
    train_df, val_df, test_df = create_chronological_station_splits(df_features)

    # =========================================================================
    # MODEL 1: ISOLATION FOREST ANOMALY DETECTION
    # =========================================================================
    logger.info("--- Training Isolation Forest ---")
    anomaly_detector = AnomalyDetector(features=IFOREST_FEATURES)
    anomaly_detector.fit(train_df)

    # Calibrate decision threshold on validation split
    selected_threshold = anomaly_detector.tune_threshold_on_validation(val_df, target_metric="f1")

    # Evaluate on validation split (contains 2 labeled fuel anomalies)
    val_preds, val_scores = anomaly_detector.predict(val_df)
    val_anomaly_metrics = evaluate_anomaly_detector(
        y_true=val_df["anomaly"].values,
        y_pred=val_preds,
        scores=val_scores,
    )
    logger.info("Isolation Forest Validation Set Metrics: %s", val_anomaly_metrics)

    # Evaluate on held-out test split (0 anomalies in test slice, tests false alarm rate)
    test_preds, test_scores = anomaly_detector.predict(test_df)
    test_anomaly_metrics = evaluate_anomaly_detector(
        y_true=test_df["anomaly"].values,
        y_pred=test_preds,
        scores=test_scores,
    )
    logger.info("Isolation Forest Test Set Metrics: %s", test_anomaly_metrics)

    # Also evaluate across entire dataset for full prototype evaluation
    full_preds, full_scores = anomaly_detector.predict(df_features)
    full_anomaly_metrics = evaluate_anomaly_detector(
        y_true=df_features["anomaly"].values,
        y_pred=full_preds,
        scores=full_scores,
    )
    logger.info("Isolation Forest Full Dataset Metrics: %s", full_anomaly_metrics)

    # =========================================================================
    # MODEL 2: RANDOM FOREST FUEL REGRESSION
    # =========================================================================
    logger.info("--- Training Fuel Prediction Regressor ---")
    fuel_predictor = FuelPredictor(
        features=FUEL_REGRESSOR_FEATURES,
        target_col="target_future_fuel_consumption",
        forecast_horizon_steps=RF_FORECAST_HORIZON_STEPS,
    )
    fuel_predictor.fit(train_df)

    # Evaluate on validation split and test split against persistence baseline
    fuel_val_metrics = fuel_predictor.evaluate_with_baseline(val_df)
    logger.info("Fuel Prediction Validation Set Metrics: %s", fuel_val_metrics)

    fuel_test_metrics = fuel_predictor.evaluate_with_baseline(test_df)
    logger.info("Fuel Prediction Test Set Metrics: %s", fuel_test_metrics)

    # =========================================================================
    # SAVE MODEL ARTIFACTS AND FEATURE SCHEMA
    # =========================================================================
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    iforest_path = anomaly_detector.save(IFOREST_MODEL_PATH)
    fuel_path = fuel_predictor.save(FUEL_REGRESSOR_MODEL_PATH)

    schema_metadata = {
        "model_version": "v1.0.0",
        "trained_timestamp": datetime.now(timezone.utc).isoformat(),
        "dataset_rows": len(df_raw),
        "stations": list(df_raw["station_id"].unique()),
        "configured_power_capacity_kw": STATION_POWER_CAPACITY_KW,
        "raw_sensor_features": RAW_SENSOR_FEATURES,
        "isolation_forest": {
            "feature_count": len(IFOREST_FEATURES),
            "feature_names": IFOREST_FEATURES,
            "decision_threshold": selected_threshold,
            "contamination": anomaly_detector.contamination,
            "n_estimators": anomaly_detector.n_estimators,
            "metrics_val": val_anomaly_metrics,
            "metrics_test": test_anomaly_metrics,
            "metrics_full": full_anomaly_metrics,
        },
        "fuel_regressor": {
            "feature_count": len(FUEL_REGRESSOR_FEATURES),
            "feature_names": FUEL_REGRESSOR_FEATURES,
            "target_variable": "target_future_fuel_consumption",
            "forecast_horizon": "1 hour (3 steps of 20 min)",
            "n_estimators": fuel_predictor.n_estimators,
            "max_depth": fuel_predictor.max_depth,
            "metrics_val": fuel_val_metrics,
            "metrics_test": fuel_test_metrics,
        },
    }

    with open(FEATURE_SCHEMA_PATH, "w", encoding="utf-8") as f:
        json.dump(schema_metadata, f, indent=2)
    logger.info("Saved feature schema metadata to %s", FEATURE_SCHEMA_PATH)

    report_summary = {
        "dataset_validation": val_report,
        "isolation_forest_val": val_anomaly_metrics,
        "isolation_forest_test": test_anomaly_metrics,
        "isolation_forest_full": full_anomaly_metrics,
        "fuel_regressor_val": fuel_val_metrics,
        "fuel_regressor_test": fuel_test_metrics,
        "saved_artifacts": {
            "isolation_forest": str(iforest_path),
            "fuel_regressor": str(fuel_path),
            "feature_schema": str(FEATURE_SCHEMA_PATH),
        },
    }
    return report_summary


if __name__ == "__main__":
    summary = train_and_evaluate_all()
    print("\n" + "=" * 60)
    print("POLAROPS ML PIPELINE EXECUTION SUMMARY")
    print("=" * 60)
    print(json.dumps(summary, indent=2))
