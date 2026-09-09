"""Fuel Prediction Module using RandomForestRegressor for PolarOps.

Forecasts near-term station fuel consumption and future fuel levels based on operational
load, generator temperature, power utilization, and ambient Antarctic weather.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from .config import (
    FUEL_REGRESSOR_MODEL_PATH,
    RF_FORECAST_HORIZON_STEPS,
    RF_MAX_DEPTH,
    RF_N_ESTIMATORS,
    RF_RANDOM_STATE,
)
from .feature_engineering import FUEL_REGRESSOR_FEATURES

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


class FuelPredictor:
    """Random Forest regressor for near-term station fuel consumption and level forecasting.

    Models operational fuel consumption delta (stationary physics) to avoid decision-tree
    extrapolation degradation, and reconstructs future fuel levels as:
    future_fuel = current_fuel - predicted_consumption.
    """

    def __init__(
        self,
        features: Optional[List[str]] = None,
        target_col: str = "target_future_fuel_consumption",
        n_estimators: int = RF_N_ESTIMATORS,
        max_depth: Optional[int] = RF_MAX_DEPTH,
        random_state: int = RF_RANDOM_STATE,
        forecast_horizon_steps: int = RF_FORECAST_HORIZON_STEPS,
    ) -> None:
        self.features = features or list(FUEL_REGRESSOR_FEATURES)
        self.target_col = target_col
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.random_state = random_state
        self.forecast_horizon_steps = forecast_horizon_steps

        # Validate no target leakage in features
        if self.target_col in self.features or "target_future_fuel_level" in self.features or "anomaly" in self.features:
            raise ValueError("CRITICAL: Target column or anomaly label detected in fuel feature list!")

        self.model = RandomForestRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self.is_fitted: bool = False

    def fit(self, train_df: pd.DataFrame) -> "FuelPredictor":
        """Fit RandomForestRegressor on training dataset.

        Drops rows where target is NaN (e.g. boundary rows where future does not exist).
        """
        valid_train = train_df.dropna(subset=[self.target_col])
        X = valid_train[self.features].values
        y = valid_train[self.target_col].values

        logger.info(
            "Training Fuel RandomForestRegressor (target: %s) with %d estimators on %d samples with %d features.",
            self.target_col,
            self.n_estimators,
            len(valid_train),
            len(self.features),
        )
        self.model.fit(X, y)
        self.is_fitted = True
        return self

    def predict_consumption(self, df: pd.DataFrame) -> np.ndarray:
        """Predict expected fuel percentage consumed over forecast horizon."""
        if not self.is_fitted:
            raise RuntimeError("FuelPredictor must be fitted before predict.")
        X = df[self.features].values
        return self.model.predict(X)

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """Predict future fuel level (in %) at forecast horizon (default 1 hour).

        Calculated as: current_fuel_level_percent - predicted_consumption.
        """
        predicted_consumption = self.predict_consumption(df)
        current_fuel = df["fuel_level_percent"].values
        predicted_future_level = current_fuel - predicted_consumption
        # Physical clipping [0, 100]
        return np.clip(predicted_future_level, 0.0, 100.0)

    def evaluate_with_baseline(
        self,
        test_df: pd.DataFrame,
    ) -> Dict[str, float]:
        """Evaluate model against persistence baseline (future_fuel ≈ current_fuel).

        Returns:
            Dictionary containing MAE, RMSE, R² for both Random Forest and Persistence Baseline.
        """
        valid_test = test_df.dropna(subset=["target_future_fuel_level"])
        y_true = valid_test["target_future_fuel_level"].values
        y_pred = self.predict(valid_test)

        # Baseline: future fuel level is assumed identical to current fuel level
        y_baseline = valid_test["fuel_level_percent"].values

        # Metrics computation
        rf_mae = float(np.mean(np.abs(y_true - y_pred)))
        rf_rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        rf_r2 = float(1.0 - (ss_res / (ss_tot + 1e-9)))

        base_mae = float(np.mean(np.abs(y_true - y_baseline)))
        base_rmse = float(np.sqrt(np.mean((y_true - y_baseline) ** 2)))
        base_ss_res = np.sum((y_true - y_baseline) ** 2)
        base_r2 = float(1.0 - (base_ss_res / (ss_tot + 1e-9)))

        mae_improvement_pct = float(((base_mae - rf_mae) / (base_mae + 1e-9)) * 100.0)

        results = {
            "model_mae": rf_mae,
            "model_rmse": rf_rmse,
            "model_r2": rf_r2,
            "baseline_mae": base_mae,
            "baseline_rmse": base_rmse,
            "baseline_r2": base_r2,
            "mae_improvement_percent": mae_improvement_pct,
            "samples_evaluated": len(valid_test),
        }
        return results

    def save(self, filepath: Optional[Union[str, Path]] = None) -> Path:
        """Serialize fitted regressor to disk."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted model.")

        path = Path(filepath) if filepath else FUEL_REGRESSOR_MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "model": self.model,
            "features": self.features,
            "target_col": self.target_col,
            "forecast_horizon_steps": self.forecast_horizon_steps,
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "random_state": self.random_state,
        }
        joblib.dump(payload, path)
        logger.info("Saved Fuel RandomForest model artifact to %s", path)
        return path

    @classmethod
    def load(cls, filepath: Optional[Union[str, Path]] = None) -> "FuelPredictor":
        """Load fitted regressor artifact from disk."""
        path = Path(filepath) if filepath else FUEL_REGRESSOR_MODEL_PATH
        if not path.exists():
            raise FileNotFoundError(f"Model artifact not found at: {path}")

        payload = joblib.load(path)
        predictor = cls(
            features=payload["features"],
            target_col=payload.get("target_col", "target_future_fuel_consumption"),
            n_estimators=payload.get("n_estimators", RF_N_ESTIMATORS),
            max_depth=payload.get("max_depth", RF_MAX_DEPTH),
            random_state=payload.get("random_state", RF_RANDOM_STATE),
            forecast_horizon_steps=payload.get("forecast_horizon_steps", RF_FORECAST_HORIZON_STEPS),
        )
        predictor.model = payload["model"]
        predictor.is_fitted = True
        logger.info("Loaded Fuel RandomForest model artifact from %s", path)
        return predictor
