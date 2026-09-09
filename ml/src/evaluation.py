"""Model evaluation utilities for PolarOps ML Anomaly Detection and Fuel Forecasting."""

import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score

from .config import TEST_SPLIT_RATIO, TRAIN_SPLIT_RATIO, VAL_SPLIT_RATIO

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


def create_chronological_station_splits(
    df: pd.DataFrame,
    train_ratio: float = TRAIN_SPLIT_RATIO,
    val_ratio: float = VAL_SPLIT_RATIO,
    test_ratio: float = TEST_SPLIT_RATIO,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Partition telemetry into train/val/test chronologically per station.

    Guarantees no temporal leakage and equal proportional representation
    of MAITRI and BHARATI across chronological time slices.
    """
    train_chunks: List[pd.DataFrame] = []
    val_chunks: List[pd.DataFrame] = []
    test_chunks: List[pd.DataFrame] = []

    stations = df["station_id"].unique() if "station_id" in df.columns else [None]

    for station in stations:
        sub = df[df["station_id"] == station].copy() if station else df.copy()
        sub = sub.sort_values("timestamp").reset_index(drop=True)
        n = len(sub)

        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)

        train_sub = sub.iloc[:n_train]
        val_sub = sub.iloc[n_train : n_train + n_val]
        test_sub = sub.iloc[n_train + n_val :]

        train_chunks.append(train_sub)
        val_chunks.append(val_sub)
        test_chunks.append(test_sub)

    train_df = pd.concat(train_chunks, axis=0).sort_values(["station_id", "timestamp"]).reset_index(drop=True)
    val_df = pd.concat(val_chunks, axis=0).sort_values(["station_id", "timestamp"]).reset_index(drop=True)
    test_df = pd.concat(test_chunks, axis=0).sort_values(["station_id", "timestamp"]).reset_index(drop=True)

    logger.info(
        "Chronological splits created: Train=%d (%.1f%%), Val=%d (%.1f%%), Test=%d (%.1f%%)",
        len(train_df),
        (len(train_df) / len(df)) * 100,
        len(val_df),
        (len(val_df) / len(df)) * 100,
        len(test_df),
        (len(test_df) / len(df)) * 100,
    )

    return train_df, val_df, test_df


def evaluate_anomaly_detector(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    scores: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """Compute precision, recall, F1, and confusion matrix for anomaly detector.

    Args:
        y_true: Ground truth binary anomaly labels (0 = normal, 1 = anomaly).
        y_pred: Predicted binary anomaly labels (0 = normal, 1 = anomaly).
        scores: Optional continuous decision scores.
    """
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()

    precision = float(precision_score(y_true, y_pred, zero_division=0))
    recall = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))

    metrics = {
        "true_positives": int(tp),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "false_negatives": int(fn),
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "ground_truth_anomalies": int(np.sum(y_true == 1)),
        "predicted_anomalies": int(np.sum(y_pred == 1)),
        "total_samples": len(y_true),
    }

    if scores is not None:
        metrics["mean_anomaly_score"] = float(np.mean(scores))
        metrics["score_at_anomalies"] = float(np.mean(scores[y_true == 1])) if np.sum(y_true == 1) > 0 else 0.0
        metrics["score_at_normal"] = float(np.mean(scores[y_true == 0])) if np.sum(y_true == 0) > 0 else 0.0

    return metrics


def evaluate_fuel_regressor(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_baseline: np.ndarray,
) -> Dict[str, float]:
    """Compute regression metrics and compare against persistence baseline."""
    rf_mae = float(np.mean(np.abs(y_true - y_pred)))
    rf_rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    rf_r2 = float(1.0 - (ss_res / (ss_tot + 1e-9)))

    base_mae = float(np.mean(np.abs(y_true - y_baseline)))
    base_rmse = float(np.sqrt(np.mean((y_true - y_baseline) ** 2)))
    base_ss_res = np.sum((y_true - y_baseline) ** 2)
    base_r2 = float(1.0 - (base_ss_res / (ss_tot + 1e-9)))

    improvement_pct = float(((base_mae - rf_mae) / (base_mae + 1e-9)) * 100.0)

    return {
        "model_mae": rf_mae,
        "model_rmse": rf_rmse,
        "model_r2": rf_r2,
        "baseline_mae": base_mae,
        "baseline_rmse": base_rmse,
        "baseline_r2": base_r2,
        "mae_improvement_pct": improvement_pct,
        "sample_count": len(y_true),
    }
