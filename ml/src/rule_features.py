"""Deterministic rule-based feature engineering for PolarOps telemetry data.

Translates operational physical thresholds into binary/continuous feature signals
for downstream ML anomaly detection and resource forecasting.
"""

from typing import Dict, Optional
import numpy as np
import pandas as pd

from .config import (
    BATTERY_CRITICAL_THRESHOLD_PERCENT,
    BATTERY_WARNING_THRESHOLD_PERCENT,
    FUEL_CRITICAL_THRESHOLD_PERCENT,
    FUEL_WARNING_THRESHOLD_PERCENT,
    GENERATOR_HIGH_LOAD_THRESHOLD_PERCENT,
    GENERATOR_HIGH_POWER_PERCENT,
    GENERATOR_HIGH_TEMP_THRESHOLD_C,
    GENERATOR_MIN_RUNNING_RPM,
    GENERATOR_STATUS_MAP,
    GENERATOR_TEMP_CRITICAL_THRESHOLD_C,
    GENERATOR_TEMP_WARNING_THRESHOLD_C,
    POWER_UTILIZATION_CRITICAL_THRESHOLD_PERCENT,
    POWER_UTILIZATION_WARNING_THRESHOLD_PERCENT,
    STATION_POWER_CAPACITY_KW,
    TEMP_HIGH_WARNING_THRESHOLD_C,
    TEMP_LOW_CRITICAL_THRESHOLD_C,
    TEMP_LOW_WARNING_THRESHOLD_C,
    WATER_CRITICAL_THRESHOLD_PERCENT,
    WATER_WARNING_THRESHOLD_PERCENT,
    WIND_SPEED_CRITICAL_THRESHOLD_KMH,
    WIND_SPEED_WARNING_THRESHOLD_KMH,
)


def compute_rule_features(
    df: pd.DataFrame,
    station_power_capacities: Optional[Dict[str, float]] = None,
) -> pd.DataFrame:
    """Compute all deterministic rule-based operational features and threshold margins.

    Args:
        df: Telemetry DataFrame containing sensor measurements.
        station_power_capacities: Optional mapping from station_id to power capacity in kW.

    Returns:
        DataFrame augmented with rule flags, normalized statuses, and margin features.
    """
    df_out = df.copy()
    capacities = station_power_capacities or STATION_POWER_CAPACITY_KW

    # 1. Fuel Rule Features (warning < 30%, critical < 15%)
    # Margin convention: positive = safe buffer remaining, negative = threshold breached
    df_out["fuel_warning_flag"] = (
        df_out["fuel_level_percent"] < FUEL_WARNING_THRESHOLD_PERCENT
    ).astype(int)
    df_out["fuel_critical_flag"] = (
        df_out["fuel_level_percent"] < FUEL_CRITICAL_THRESHOLD_PERCENT
    ).astype(int)
    df_out["fuel_margin_to_warning"] = (
        df_out["fuel_level_percent"] - FUEL_WARNING_THRESHOLD_PERCENT
    )
    df_out["fuel_margin_to_critical"] = (
        df_out["fuel_level_percent"] - FUEL_CRITICAL_THRESHOLD_PERCENT
    )

    # 2. Battery Rule Features (warning < 40%, critical < 20%)
    df_out["battery_warning_flag"] = (
        df_out["battery_level_percent"] < BATTERY_WARNING_THRESHOLD_PERCENT
    ).astype(int)
    df_out["battery_critical_flag"] = (
        df_out["battery_level_percent"] < BATTERY_CRITICAL_THRESHOLD_PERCENT
    ).astype(int)
    df_out["battery_margin_to_warning"] = (
        df_out["battery_level_percent"] - BATTERY_WARNING_THRESHOLD_PERCENT
    )
    df_out["battery_margin_to_critical"] = (
        df_out["battery_level_percent"] - BATTERY_CRITICAL_THRESHOLD_PERCENT
    )

    # 3. Water Rule Features (warning < 30%, critical < 10%)
    df_out["water_warning_flag"] = (
        df_out["water_level_percent"] < WATER_WARNING_THRESHOLD_PERCENT
    ).astype(int)
    df_out["water_critical_flag"] = (
        df_out["water_level_percent"] < WATER_CRITICAL_THRESHOLD_PERCENT
    ).astype(int)
    df_out["water_margin_to_warning"] = (
        df_out["water_level_percent"] - WATER_WARNING_THRESHOLD_PERCENT
    )
    df_out["water_margin_to_critical"] = (
        df_out["water_level_percent"] - WATER_CRITICAL_THRESHOLD_PERCENT
    )

    # 4. Generator Temperature Rule Features (warning > 80°C, critical > 90°C)
    # Margin convention: threshold - current_temp. Negative means threshold exceeded.
    df_out["generator_temp_warning_flag"] = (
        df_out["generator_temperature_c"] > GENERATOR_TEMP_WARNING_THRESHOLD_C
    ).astype(int)
    df_out["generator_temp_critical_flag"] = (
        df_out["generator_temperature_c"] > GENERATOR_TEMP_CRITICAL_THRESHOLD_C
    ).astype(int)
    df_out["generator_temp_margin_to_warning"] = (
        GENERATOR_TEMP_WARNING_THRESHOLD_C - df_out["generator_temperature_c"]
    )
    df_out["generator_temp_margin_to_critical"] = (
        GENERATOR_TEMP_CRITICAL_THRESHOLD_C - df_out["generator_temperature_c"]
    )

    # 5. Wind Speed Rule Features (raw mps converted to km/h; warning > 60, critical > 100)
    df_out["wind_speed_kmh"] = df_out["wind_speed_mps"] * 3.6
    df_out["wind_warning_flag"] = (
        df_out["wind_speed_kmh"] > WIND_SPEED_WARNING_THRESHOLD_KMH
    ).astype(int)
    df_out["wind_critical_flag"] = (
        df_out["wind_speed_kmh"] > WIND_SPEED_CRITICAL_THRESHOLD_KMH
    ).astype(int)
    df_out["wind_margin_to_warning"] = (
        WIND_SPEED_WARNING_THRESHOLD_KMH - df_out["wind_speed_kmh"]
    )
    df_out["wind_margin_to_critical"] = (
        WIND_SPEED_CRITICAL_THRESHOLD_KMH - df_out["wind_speed_kmh"]
    )

    # 6. Power Consumption Rule Features
    # Utilization % = (power_kw / capacity_kw) * 100
    if "station_id" in df_out.columns:
        station_capacities = df_out["station_id"].map(capacities).fillna(800.0)
    else:
        station_capacities = 800.0

    df_out["power_utilization_percent"] = (
        df_out["power_consumption_kw"] / station_capacities
    ) * 100.0
    df_out["power_warning_flag"] = (
        df_out["power_utilization_percent"] > POWER_UTILIZATION_WARNING_THRESHOLD_PERCENT
    ).astype(int)
    df_out["power_critical_flag"] = (
        df_out["power_utilization_percent"] > POWER_UTILIZATION_CRITICAL_THRESHOLD_PERCENT
    ).astype(int)
    df_out["power_margin_to_warning"] = (
        POWER_UTILIZATION_WARNING_THRESHOLD_PERCENT - df_out["power_utilization_percent"]
    )
    df_out["power_margin_to_critical"] = (
        POWER_UTILIZATION_CRITICAL_THRESHOLD_PERCENT - df_out["power_utilization_percent"]
    )

    # 7. Ambient Temperature Rule Features
    # warning < -40°C or > 5°C; critical < -50°C
    df_out["temp_low_extreme_flag"] = (
        df_out["temperature_c"] < TEMP_LOW_WARNING_THRESHOLD_C
    ).astype(int)
    df_out["temp_high_extreme_flag"] = (
        df_out["temperature_c"] > TEMP_HIGH_WARNING_THRESHOLD_C
    ).astype(int)
    df_out["temperature_warning_flag"] = (
        (df_out["temperature_c"] < TEMP_LOW_WARNING_THRESHOLD_C)
        | (df_out["temperature_c"] > TEMP_HIGH_WARNING_THRESHOLD_C)
    ).astype(int)
    df_out["temperature_critical_flag"] = (
        df_out["temperature_c"] < TEMP_LOW_CRITICAL_THRESHOLD_C
    ).astype(int)

    # 8. Generator Status Normalization
    status_series = df_out["generator_status"].astype(str).str.strip().str.upper()
    df_out["generator_status_normalized"] = status_series.map(GENERATOR_STATUS_MAP).fillna(0).astype(int)
    df_out["generator_degraded_flag"] = (df_out["generator_status_normalized"] == 1).astype(int)
    df_out["generator_failure_flag"] = (df_out["generator_status_normalized"] >= 2).astype(int)

    # 9. Cross-Sensor Operational Consistency Signals
    # Non-running status with high load
    is_inactive_status = df_out["generator_status_normalized"] > 0
    df_out["generator_off_high_load"] = (
        is_inactive_status & (df_out["generator_load_percent"] > GENERATOR_HIGH_LOAD_THRESHOLD_PERCENT)
    ).astype(int)

    # Inactive status with high RPM
    df_out["generator_off_nonzero_rpm"] = (
        is_inactive_status & (df_out["generator_rpm"] > GENERATOR_MIN_RUNNING_RPM)
    ).astype(int)

    # High temp accompanied by high load
    df_out["generator_high_temp_high_load"] = (
        (df_out["generator_temperature_c"] > GENERATOR_HIGH_TEMP_THRESHOLD_C)
        & (df_out["generator_load_percent"] > GENERATOR_HIGH_LOAD_THRESHOLD_PERCENT)
    ).astype(int)

    # High generator load accompanied by high electrical power utilization
    df_out["generator_high_load_high_power"] = (
        (df_out["generator_load_percent"] > GENERATOR_HIGH_LOAD_THRESHOLD_PERCENT)
        & (df_out["power_utilization_percent"] > GENERATOR_HIGH_POWER_PERCENT)
    ).astype(int)

    return df_out
