"""Configuration and operational threshold definitions for PolarOps ML Module.

SIH26060 — Digital Platform for Efficient Remote Management of Indian Antarctic
Research Stations (BHARATI, MAITRI).
Project Name: PolarOps
"""

from pathlib import Path
from typing import Dict

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
DEFAULT_DATA_PATH = DATA_DIR / "antarctic_station_2000_points-1.csv"

ISOLATION_FOREST_MODEL_PATH = MODELS_DIR / "isolation_forest.joblib"
IFOREST_MODEL_PATH = ISOLATION_FOREST_MODEL_PATH
FUEL_REGRESSOR_MODEL_PATH = MODELS_DIR / "fuel_random_forest.joblib"
FUEL_MODEL_PATH = FUEL_REGRESSOR_MODEL_PATH
FEATURE_SCHEMA_PATH = MODELS_DIR / "feature_schema.json"

# Station Identifiers
VALID_STATIONS = ("BHARATI", "MAITRI")

# Station Power Capacities (in kW)
# NOTE: These represent prototype nominal capacities configured for testing and demonstration.
# Normal station telemetry ranges 220 kW - 600 kW, with observed peaks at 760 kW (BHARATI)
# and 800 kW (MAITRI). These values are fully configurable and NOT official NCPOR ratings.
STATION_POWER_CAPACITY_KW: Dict[str, float] = {
    "BHARATI": 800.0,
    "MAITRI": 800.0,
}

# Operational Threshold Configurations
# Fuel (%): warning < 30%, critical < 15%
FUEL_WARNING_THRESHOLD_PERCENT: float = 30.0
FUEL_CRITICAL_THRESHOLD_PERCENT: float = 15.0

# Battery (%): warning < 40%, critical < 20%
BATTERY_WARNING_THRESHOLD_PERCENT: float = 40.0
BATTERY_CRITICAL_THRESHOLD_PERCENT: float = 20.0

# Water (%): warning < 30%, critical < 10%
WATER_WARNING_THRESHOLD_PERCENT: float = 30.0
WATER_CRITICAL_THRESHOLD_PERCENT: float = 10.0

# Generator Temperature (°C): warning > 80°C, critical > 90°C
GENERATOR_TEMP_WARNING_THRESHOLD_C: float = 80.0
GENERATOR_TEMP_CRITICAL_THRESHOLD_C: float = 90.0

# Wind Speed (km/h): warning > 60 km/h, critical > 100 km/h
# Note: Raw data provides wind_speed_mps; convert via * 3.6 before comparing.
WIND_SPEED_WARNING_THRESHOLD_KMH: float = 60.0
WIND_SPEED_CRITICAL_THRESHOLD_KMH: float = 100.0

# Power Utilization (% of station capacity): warning > 85%, critical > 95%
POWER_UTILIZATION_WARNING_THRESHOLD_PERCENT: float = 85.0
POWER_UTILIZATION_CRITICAL_THRESHOLD_PERCENT: float = 95.0

# Ambient Temperature (°C):
# Low warning < -40°C, High warning > 5°C, Low critical < -50°C
TEMP_LOW_WARNING_THRESHOLD_C: float = -40.0
TEMP_HIGH_WARNING_THRESHOLD_C: float = 5.0
TEMP_LOW_CRITICAL_THRESHOLD_C: float = -50.0

# Generator Operational Consistency Thresholds
GENERATOR_MIN_RUNNING_RPM: float = 100.0
GENERATOR_HIGH_LOAD_THRESHOLD_PERCENT: float = 75.0
GENERATOR_HIGH_TEMP_THRESHOLD_C: float = 80.0
GENERATOR_HIGH_POWER_PERCENT: float = 85.0

# Generator Status Normalization Map
# Raw values: RUNNING (normal), STANDBY (degraded), OFF / FAILURE (critical)
GENERATOR_STATUS_MAP: Dict[str, int] = {
    "RUNNING": 0,
    "STANDBY": 1,
    "OFF": 2,
    "FAILURE": 2,
    "MAINTENANCE": 1,
}

# Time intervals and Sampling
# Consecutive points per station are approximately 20 minutes apart (3 observations per hour).
STATION_INTERVAL_MINUTES: float = 20.0
OBSERVATIONS_PER_HOUR: int = 3
ROLLING_WINDOW_1H: int = 3   # 1 hour = 3 steps (at 20-min sampling)
ROLLING_WINDOW_3H: int = 9   # 3 hours = 9 steps
ROLLING_WINDOW_6H: int = 18  # 6 hours = 18 steps

# Chronological Train / Val / Test Split Ratios
TRAIN_SPLIT_RATIO: float = 0.70
VAL_SPLIT_RATIO: float = 0.15
TEST_SPLIT_RATIO: float = 0.15

# Isolation Forest Hyperparameters
IFOREST_N_ESTIMATORS: int = 200
IFOREST_CONTAMINATION: float = 0.01  # Tuned on validation split; initial starting point
IFOREST_RANDOM_STATE: int = 42

# Random Forest Regressor Hyperparameters (Fuel Prediction)
RF_N_ESTIMATORS: int = 200
RF_MAX_DEPTH: int = 12
RF_RANDOM_STATE: int = 42
RF_FORECAST_HORIZON_STEPS: int = 3  # 3 steps * 20 min = 1 hour ahead forecast
