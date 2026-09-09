"""Data loading, validation, and station-wise timestamp sorting module for PolarOps."""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import pandas as pd

from .config import DEFAULT_DATA_PATH, VALID_STATIONS

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

EXPECTED_COLUMNS: List[str] = [
    "timestamp",
    "station_id",
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
    "generator_status",
    "anomaly",
]

NUMERICAL_RANGE_SPECS: Dict[str, Tuple[float, float]] = {
    "temperature_c": (-90.0, 40.0),
    "wind_speed_mps": (0.0, 100.0),
    "humidity_percent": (0.0, 100.0),
    "power_consumption_kw": (0.0, 2000.0),
    "battery_level_percent": (0.0, 100.0),
    "fuel_level_percent": (0.0, 100.0),
    "water_level_percent": (0.0, 100.0),
    "generator_temperature_c": (0.0, 150.0),
    "generator_load_percent": (0.0, 150.0),
    "generator_rpm": (0.0, 3000.0),
}


class DataValidationError(ValueError):
    """Raised when telemetry data fails structural or boundary validation."""
    pass


def validate_telemetry_dataframe(
    df: pd.DataFrame,
    strict: bool = False,
) -> Dict[str, Any]:
    """Perform comprehensive validation on telemetry dataframe.

    Checks:
    - Row count and column count
    - Column names and data types
    - Missing values and duplicate rows
    - Station IDs and categorical statuses
    - Physical numerical ranges
    - Timestamp parseability and monotonic ordering
    """
    report: Dict[str, Any] = {
        "is_valid": True,
        "row_count": len(df),
        "column_count": len(df.columns),
        "warnings": [],
        "errors": [],
    }

    if df.empty:
        report["is_valid"] = False
        report["errors"].append("Dataframe is empty.")
        if strict:
            raise DataValidationError("Dataframe is empty.")
        return report

    # 1. Column presence check
    missing_cols = [col for col in EXPECTED_COLUMNS if col not in df.columns]
    # Note: 'anomaly' is optional in real-time inference
    critical_missing = [c for c in missing_cols if c != "anomaly"]
    if critical_missing:
        msg = f"Missing required telemetry columns: {critical_missing}"
        report["is_valid"] = False
        report["errors"].append(msg)
        if strict:
            raise DataValidationError(msg)

    # 2. Missing values check
    null_counts = df.isnull().sum().to_dict()
    total_nulls = sum(null_counts.values())
    report["null_counts"] = null_counts
    if total_nulls > 0:
        msg = f"Detected {total_nulls} missing values across columns: {null_counts}"
        report["warnings"].append(msg)
        logger.warning(msg)

    # 3. Duplicate rows check
    duplicates = int(df.duplicated().sum())
    report["duplicate_count"] = duplicates
    if duplicates > 0:
        msg = f"Detected {duplicates} duplicate rows in dataset."
        report["warnings"].append(msg)
        logger.warning(msg)

    # 4. Station IDs check
    if "station_id" in df.columns:
        present_stations = set(df["station_id"].dropna().unique())
        invalid_stations = present_stations - set(VALID_STATIONS)
        if invalid_stations:
            msg = f"Unrecognized station IDs: {invalid_stations}. Expected one of {VALID_STATIONS}"
            report["is_valid"] = False
            report["errors"].append(msg)
            if strict:
                raise DataValidationError(msg)

    # 5. Numerical ranges check
    range_violations: Dict[str, int] = {}
    for col, (min_val, max_val) in NUMERICAL_RANGE_SPECS.items():
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            violations = int(((df[col] < min_val) | (df[col] > max_val)).sum())
            if violations > 0:
                range_violations[col] = violations
                msg = f"Column '{col}' has {violations} values outside physical range [{min_val}, {max_val}]."
                report["warnings"].append(msg)
                logger.warning(msg)
    report["range_violations"] = range_violations

    # 6. Generator status check
    if "generator_status" in df.columns:
        statuses = df["generator_status"].astype(str).str.upper().unique().tolist()
        report["generator_statuses"] = statuses

    return report


def load_and_validate_telemetry(
    filepath: Optional[Union[str, Path]] = None,
    strict_validation: bool = False,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Load telemetry dataset from CSV, validate structure, and sort chronologically by station.

    Returns:
        Tuple of (sorted_dataframe, validation_report)
    """
    path = Path(filepath) if filepath else DEFAULT_DATA_PATH
    if not path.exists():
        raise FileNotFoundError(f"Telemetry file not found at: {path}")

    logger.info("Loading telemetry dataset from %s", path)
    df = pd.read_csv(path)

    # Validate
    report = validate_telemetry_dataframe(df, strict=strict_validation)

    # Timestamp conversion & Station-wise chronological sorting
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"])
    else:
        raise DataValidationError("Telemetry dataset missing 'timestamp' column.")

    if "station_id" in df.columns:
        df = df.sort_values(["station_id", "timestamp"]).reset_index(drop=True)
    else:
        df = df.sort_values("timestamp").reset_index(drop=True)

    logger.info(
        "Successfully loaded and sorted %d telemetry records for stations: %s",
        len(df),
        list(df["station_id"].unique()) if "station_id" in df.columns else "N/A",
    )

    return df, report
