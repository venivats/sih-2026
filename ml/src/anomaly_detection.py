"""Unsupervised Anomaly Detection Module using Isolation Forest for PolarOps.

Monitors multi-sensor correlations across environmental and operational telemetry
to detect emergent station degradation before catastrophic threshold violation.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from .config import (
    IFOREST_CONTAMINATION,
    IFOREST_MODEL_PATH,
    IFOREST_N_ESTIMATORS,
    IFOREST_RANDOM_STATE,
)
from .feature_engineering import IFOREST_FEATURES

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


class AnomalyDetector:
    """Unsupervised multivariate anomaly detector wrapping scikit-learn Isolation Forest."""

    def __init__(
        self,
        features: Optional[List[str]] = None,
        n_estimators: int = IFOREST_N_ESTIMATORS,
        contamination: float = IFOREST_CONTAMINATION,
        random_state: int = IFOREST_RANDOM_STATE,
    ) -> None:
        self.features = features or list(IFOREST_FEATURES)
        # CRITICAL SAFETY CHECK: 'anomaly' must never be in feature list
        if "anomaly" in self.features:
            raise ValueError("CRITICAL: 'anomaly' target column found in unsupervised feature list!")

        self.n_estimators = n_estimators
        self.contamination = contamination
        self.random_state = random_state
        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self.is_fitted: bool = False
        self.decision_threshold: float = 0.0  # Default scikit-learn decision threshold

    def fit(self, X: pd.DataFrame) -> "AnomalyDetector":
        """Fit Isolation Forest on training features.

        Args:
            X: Telemetry DataFrame containing at least self.features.
        """
        logger.info(
            "Fitting IsolationForest with %d estimators, contamination=%.4f on %d samples with %d features.",
            self.n_estimators,
            self.contamination,
            len(X),
            len(self.features),
        )
        X_mat = X[self.features].values
        self.model.fit(X_mat)
        self.is_fitted = True
        return self

    def tune_threshold_on_validation(
        self,
        val_df: pd.DataFrame,
        ground_truth_col: str = "anomaly",
        target_metric: str = "f1",
    ) -> float:
        """Calibrate decision score threshold using validation split labels.

        Note: Ground truth is used strictly for threshold calibration on validation,
        never during model training.
        """
        if not self.is_fitted:
            raise RuntimeError("AnomalyDetector must be fitted before threshold tuning.")

        if ground_truth_col not in val_df.columns:
            logger.warning("No ground truth '%s' column in validation data. Keeping default threshold 0.0.", ground_truth_col)
            return self.decision_threshold

        # raw decision function: negative means more anomalous
        scores = self.model.decision_function(val_df[self.features].values)
        y_true = val_df[ground_truth_col].values

        # Sweep candidate thresholds from 0.1% up to 10.0% of score distribution
        p_thresholds = np.percentile(scores, np.linspace(0.1, 10.0, 100))
        linear_thresholds = np.linspace(np.min(scores), np.percentile(scores, 15), 100)
        candidate_thresholds = np.unique(np.concatenate([p_thresholds, linear_thresholds, [0.0]]))

        best_th = 0.0
        best_score = -1.0

        for th in candidate_thresholds:
            # If decision_function < th, it is an anomaly (1), else normal (0)
            preds = (scores < th).astype(int)
            tp = np.sum((preds == 1) & (y_true == 1))
            fp = np.sum((preds == 1) & (y_true == 0))
            fn = np.sum((preds == 0) & (y_true == 1))

            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

            if target_metric == "f1" and f1 > best_score:
                best_score = f1
                best_th = th
            elif target_metric == "recall" and recall > best_score:
                best_score = recall
                best_th = th

        logger.info("Validation threshold tuning selected threshold: %.4f (Validation %s: %.4f)", best_th, target_metric, best_score)
        self.decision_threshold = best_th
        return best_th

    def predict(self, X: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Generate anomaly predictions and continuous anomaly scores.

        Returns:
            Tuple of:
            - binary_predictions: 0 for normal, 1 for anomaly
            - anomaly_scores: continuous decision scores (lower = more anomalous)
        """
        if not self.is_fitted:
            raise RuntimeError("AnomalyDetector must be fitted before predict.")

        X_mat = X[self.features].values
        raw_scores = self.model.decision_function(X_mat)

        # Standard scikit-learn convention: decision_function < decision_threshold is anomaly
        binary_preds = (raw_scores < self.decision_threshold).astype(int)

        return binary_preds, raw_scores

    def save(self, filepath: Optional[Union[str, Path]] = None) -> Path:
        """Serialize fitted model to disk."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted model.")

        path = Path(filepath) if filepath else IFOREST_MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "model": self.model,
            "features": self.features,
            "decision_threshold": self.decision_threshold,
            "contamination": self.contamination,
            "n_estimators": self.n_estimators,
            "random_state": self.random_state,
        }
        joblib.dump(payload, path)
        logger.info("Saved IsolationForest model artifact to %s", path)
        return path

    @classmethod
    def load(cls, filepath: Optional[Union[str, Path]] = None) -> "AnomalyDetector":
        """Load fitted model artifact from disk."""
        path = Path(filepath) if filepath else IFOREST_MODEL_PATH
        if not path.exists():
            raise FileNotFoundError(f"Model artifact not found at: {path}")

        payload = joblib.load(path)
        detector = cls(
            features=payload["features"],
            n_estimators=payload.get("n_estimators", IFOREST_N_ESTIMATORS),
            contamination=payload.get("contamination", IFOREST_CONTAMINATION),
            random_state=payload.get("random_state", IFOREST_RANDOM_STATE),
        )
        detector.model = payload["model"]
        detector.decision_threshold = payload.get("decision_threshold", 0.0)
        detector.is_fitted = True
        logger.info("Loaded IsolationForest model artifact from %s", path)
        return detector
