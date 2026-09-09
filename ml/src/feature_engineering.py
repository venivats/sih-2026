"""Feature engineering pipeline for PolarOps telemetry.

Generates temporal, delta, rate-of-change, rolling window, deviation, and lag features
strictly partitioned per research station to prevent inter-station boundary leakage.
"""

from typing import List, Optional
import numpy as np
import pandas as pd

from .config import (
    OBSERVATIONS_PER_HOUR,
    RF_FORECAST_HORIZON_STEPS,
    ROLLING_WINDOW_1H,
    ROLLING_WINDOW_3H,
    STATION_INTERVAL_MINUTES,
)
from .rule_features import compute_rule_features


# Feature Sets Definition
RAW_SENSOR_FEATURES: List[str] = [
    "temperature_c",
    "wind_speed_mps",
    "humidity_percent",
    "power_consumption_kw",
    "battery_level_percent",
    "fuel_level_percent",
    "water_level_percent",
    "generator_temperature_c",
    "generator_load_percent",
    "generator_rpm",
]

# Curated Feature List for Isolation Forest (~35 features)
IFOREST_FEATURES: List[str] = [
    # Raw physical sensors
    "temperature_c",
    "wind_speed_kmh",
    "humidity_percent",
    "power_consumption_kw",
    "battery_level_percent",
    "fuel_level_percent",
    "water_level_percent",
    "generator_temperature_c",
    "generator_load_percent",
    "generator_rpm",
    # Deltas and rates
    "power_delta",
    "generator_temp_delta",
    "fuel_consumption_rate",
    "power_change_rate",
    "generator_load_delta",
    "generator_rpm_delta",
    "temp_delta",
    # Rolling statistics (1h)
    "power_1h_mean",
    "power_1h_std",
    "generator_temp_1h_mean",
    "generator_temp_1h_std",
    "fuel_1h_mean",
    "generator_load_1h_mean",
    # Deviations and Z-scores
    "power_deviation",
    "generator_temp_deviation",
    "power_rolling_z",
    "generator_temp_rolling_z",
    # Selected Rule Signals & Margins
    "fuel_warning_flag",
    "generator_temp_warning_flag",
    "generator_temp_critical_flag",
    "generator_temp_margin_to_critical",
    "power_warning_flag",
    "power_critical_flag",
    "power_utilization_percent",
    "wind_warning_flag",
    # Operational Consistency
    "generator_status_normalized",
    "generator_high_temp_high_load",
    "generator_high_load_high_power",
    "generator_off_high_load",
]

# Curated Feature List for Fuel RandomForestRegressor (~24 features)
FUEL_REGRESSOR_FEATURES: List[str] = [
    "fuel_level_percent",
    "fuel_delta",
    "fuel_consumption_rate",
    "fuel_1h_mean",
    "fuel_1h_std",
    "fuel_3h_mean",
    "fuel_lag_1",
    "fuel_lag_3",
    "fuel_lag_6",
    # Operational Drivers
    "power_consumption_kw",
    "power_utilization_percent",
    "power_1h_mean",
    "power_lag_1",
    "generator_load_percent",
    "generator_load_1h_mean",
    "generator_temperature_c",
    "generator_temp_1h_mean",
    "temperature_c",
    "wind_speed_kmh",
    "battery_level_percent",
    "hour_sin",
    "hour_cos",
    "generator_status_normalized",
    "station_is_maitri",
]


def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create basic calendar and cyclical timestamp features."""
    df_out = df.copy()
    ts = pd.to_datetime(df_out["timestamp"])

    df_out["hour"] = ts.dt.hour
    df_out["day_of_week"] = ts.dt.dayofweek
    df_out["day"] = ts.dt.day

    # Cyclical encodings
    df_out["hour_sin"] = np.sin(2 * np.pi * df_out["hour"] / 24.0)
    df_out["hour_cos"] = np.cos(2 * np.pi * df_out["hour"] / 24.0)
    df_out["day_of_week_sin"] = np.sin(2 * np.pi * df_out["day_of_week"] / 7.0)
    df_out["day_of_week_cos"] = np.cos(2 * np.pi * df_out["day_of_week"] / 7.0)

    return df_out


def add_station_encoding(df: pd.DataFrame) -> pd.DataFrame:
    """Add station binary indicator features."""
    df_out = df.copy()
    if "station_id" in df_out.columns:
        df_out["station_is_maitri"] = (df_out["station_id"] == "MAITRI").astype(int)
        df_out["station_is_bharati"] = (df_out["station_id"] == "BHARATI").astype(int)
    else:
        df_out["station_is_maitri"] = 0
        df_out["station_is_bharati"] = 0
    return df_out


def add_stationwise_deltas_and_rates(df: pd.DataFrame) -> pd.DataFrame:
    """Compute station-wise differences and time-based rates of change."""
    df_out = df.copy()
    group = df_out.groupby("station_id") if "station_id" in df_out.columns else df_out

    # Deltas
    df_out["temp_delta"] = group["temperature_c"].diff().fillna(0.0)
    df_out["wind_delta"] = group["wind_speed_mps"].diff().fillna(0.0)
    df_out["power_delta"] = group["power_consumption_kw"].diff().fillna(0.0)
    df_out["battery_delta"] = group["battery_level_percent"].diff().fillna(0.0)
    df_out["fuel_delta"] = group["fuel_level_percent"].diff().fillna(0.0)
    df_out["water_delta"] = group["water_level_percent"].diff().fillna(0.0)
    df_out["generator_temp_delta"] = group["generator_temperature_c"].diff().fillna(0.0)
    df_out["generator_load_delta"] = group["generator_load_percent"].diff().fillna(0.0)
    df_out["generator_rpm_delta"] = group["generator_rpm"].diff().fillna(0.0)

    # Time delta calculation in hours (per station)
    nominal_dt_hours = STATION_INTERVAL_MINUTES / 60.0  # 20 min = 0.3333 hours
    if "timestamp" in df_out.columns:
        ts = pd.to_datetime(df_out["timestamp"])
        time_diff_sec = group[ts.name].diff().dt.total_seconds() if "station_id" in df_out.columns else ts.diff().dt.total_seconds()
        # Fallback to nominal if 0 or NaN
        time_delta_h = time_diff_sec / 3600.0
        time_delta_h = time_delta_h.apply(lambda x: nominal_dt_hours if pd.isna(x) or x <= 0 else x)
    else:
        time_delta_h = pd.Series(nominal_dt_hours, index=df_out.index)

    df_out["time_delta_hours"] = time_delta_h

    # Rate features
    # Positive fuel_consumption_rate means fuel is being consumed (fuel_delta is negative)
    df_out["fuel_consumption_rate"] = -(df_out["fuel_delta"] / df_out["time_delta_hours"])
    df_out["power_change_rate"] = df_out["power_delta"] / df_out["time_delta_hours"]
    df_out["battery_change_rate"] = df_out["battery_delta"] / df_out["time_delta_hours"]

    return df_out


def add_stationwise_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute rolling window means and standard deviations partitioned by station."""
    df_out = df.copy()

    roll_mapping = {
        "temperature_c": "temperature",
        "power_consumption_kw": "power",
        "fuel_level_percent": "fuel",
        "battery_level_percent": "battery",
        "generator_temperature_c": "generator_temp",
        "generator_load_percent": "generator_load",
        "wind_speed_mps": "wind_speed",
    }

    def _roll_station(sub_df: pd.DataFrame) -> pd.DataFrame:
        sub = sub_df.copy()
        for col, prefix in roll_mapping.items():
            # 1-hour window (3 observations at 20-min sampling)
            r1 = sub[col].rolling(window=ROLLING_WINDOW_1H, min_periods=1)
            sub[f"{prefix}_1h_mean"] = r1.mean()
            sub[f"{prefix}_1h_std"] = r1.std().fillna(0.0)

        # 3-hour window for selected drivers (fuel, power, generator temp)
        r3_fuel = sub["fuel_level_percent"].rolling(window=ROLLING_WINDOW_3H, min_periods=1)
        sub["fuel_3h_mean"] = r3_fuel.mean()
        sub["fuel_3h_std"] = r3_fuel.std().fillna(0.0)

        r3_power = sub["power_consumption_kw"].rolling(window=ROLLING_WINDOW_3H, min_periods=1)
        sub["power_3h_mean"] = r3_power.mean()

        r3_gen_temp = sub["generator_temperature_c"].rolling(window=ROLLING_WINDOW_3H, min_periods=1)
        sub["generator_temp_3h_mean"] = r3_gen_temp.mean()

        return sub

    if "station_id" in df_out.columns:
        station_chunks = []
        for _, sub in df_out.groupby("station_id", sort=False):
            station_chunks.append(_roll_station(sub))
        df_out = pd.concat(station_chunks, axis=0).sort_index()
    else:
        df_out = _roll_station(df_out)

    return df_out


def add_deviation_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute deviation from rolling mean and rolling z-scores."""
    df_out = df.copy()

    # Absolute deviations from recent 1h average
    df_out["power_deviation"] = df_out["power_consumption_kw"] - df_out["power_1h_mean"]
    df_out["temp_deviation"] = df_out["temperature_c"] - df_out["temperature_1h_mean"]
    df_out["fuel_deviation"] = df_out["fuel_level_percent"] - df_out["fuel_1h_mean"]
    df_out["generator_temp_deviation"] = df_out["generator_temperature_c"] - df_out["generator_temp_1h_mean"]

    # Rolling Z-scores (protected against std=0)
    eps = 1e-4
    df_out["power_rolling_z"] = df_out["power_deviation"] / (df_out["power_1h_std"] + eps)
    df_out["generator_temp_rolling_z"] = df_out["generator_temp_deviation"] / (df_out["generator_temp_1h_std"] + eps)

    return df_out


def add_stationwise_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute selected lag features per station."""
    df_out = df.copy()
    group = df_out.groupby("station_id") if "station_id" in df_out.columns else df_out

    # Fuel lags (1 step = 20m, 3 steps = 1h, 6 steps = 2h)
    df_out["fuel_lag_1"] = group["fuel_level_percent"].shift(1).bfill().fillna(df_out["fuel_level_percent"])
    df_out["fuel_lag_3"] = group["fuel_level_percent"].shift(3).bfill().fillna(df_out["fuel_level_percent"])
    df_out["fuel_lag_6"] = group["fuel_level_percent"].shift(6).bfill().fillna(df_out["fuel_level_percent"])

    # Power lags
    df_out["power_lag_1"] = group["power_consumption_kw"].shift(1).bfill().fillna(df_out["power_consumption_kw"])
    df_out["power_lag_3"] = group["power_consumption_kw"].shift(3).bfill().fillna(df_out["power_consumption_kw"])

    # Temperature lags
    df_out["temp_lag_1"] = group["temperature_c"].shift(1).bfill().fillna(df_out["temperature_c"])
    df_out["temp_lag_3"] = group["temperature_c"].shift(3).bfill().fillna(df_out["temperature_c"])

    # Battery lags
    df_out["battery_lag_1"] = group["battery_level_percent"].shift(1).bfill().fillna(df_out["battery_level_percent"])
    df_out["battery_lag_3"] = group["battery_level_percent"].shift(3).bfill().fillna(df_out["battery_level_percent"])

    return df_out


def create_future_fuel_targets(
    df: pd.DataFrame,
    horizon_steps: int = RF_FORECAST_HORIZON_STEPS,
) -> pd.DataFrame:
    """Create forward-shifted future fuel target for regression.

    Strictly computed per station:
    - target_future_fuel_level: fuel level at (current_time + horizon_steps * 20m)
    - target_future_fuel_consumption: current_fuel - future_fuel
    """
    df_out = df.copy()
    group = df_out.groupby("station_id") if "station_id" in df_out.columns else df_out

    future_fuel = group["fuel_level_percent"].shift(-horizon_steps)
    df_out["target_future_fuel_level"] = future_fuel
    df_out["target_future_fuel_consumption"] = df_out["fuel_level_percent"] - future_fuel

    return df_out


def build_full_feature_pipeline(
    df: pd.DataFrame,
    include_future_target: bool = False,
    forecast_horizon: int = RF_FORECAST_HORIZON_STEPS,
) -> pd.DataFrame:
    """Execute complete end-to-end feature engineering pipeline in correct order.

    Pipeline:
    1. Ensure station-wise sorting
    2. Rule-based features and margins
    3. Temporal features & cyclical encodings
    4. Station encoding
    5. Station-wise deltas & rates
    6. Station-wise rolling features
    7. Deviation & Z-score features
    8. Station-wise lag features
    9. (Optional) Future regression targets
    """
    # 1. Sort
    df_proc = df.copy()
    if "timestamp" in df_proc.columns:
        df_proc["timestamp"] = pd.to_datetime(df_proc["timestamp"])
    if "station_id" in df_proc.columns:
        df_proc = df_proc.sort_values(["station_id", "timestamp"]).reset_index(drop=True)

    # 2. Rule features
    df_proc = compute_rule_features(df_proc)

    # 3. Temporal features
    df_proc = add_temporal_features(df_proc)

    # 4. Station encoding
    df_proc = add_station_encoding(df_proc)

    # 5. Deltas & rates
    df_proc = add_stationwise_deltas_and_rates(df_proc)

    # 6. Rolling features
    df_proc = add_stationwise_rolling_features(df_proc)

    # 7. Deviations & Z-scores
    df_proc = add_deviation_features(df_proc)

    # 8. Lag features
    df_proc = add_stationwise_lag_features(df_proc)

    # 9. Future targets (only for training/evaluating fuel model)
    if include_future_target:
        df_proc = create_future_fuel_targets(df_proc, horizon_steps=forecast_horizon)

    # Standardize column naming for generator temp in features if needed
    if "generator_temperature_1h_mean" in df_proc.columns and "generator_temp_1h_mean" not in df_proc.columns:
        df_proc["generator_temp_1h_mean"] = df_proc["generator_temperature_1h_mean"]
        df_proc["generator_temp_1h_std"] = df_proc["generator_temperature_1h_std"]

    # Final cleanup of any unexpected infinite or NaN values
    numeric_cols = df_proc.select_dtypes(include=[np.number]).columns
    # Exclude targets from fillna
    target_cols = [c for c in ["target_future_fuel_level", "target_future_fuel_consumption"] if c in df_proc.columns]
    fill_cols = [c for c in numeric_cols if c not in target_cols and c != "anomaly"]
    df_proc[fill_cols] = df_proc[fill_cols].replace([np.inf, -np.inf], 0.0).fillna(0.0)

    return df_proc
