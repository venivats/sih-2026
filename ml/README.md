# PolarOps — Machine Learning & Rule-Based Feature Engineering Module

**Project Name**: PolarOps  
**Problem Statement**: SIH26060 — Digital Platform for Efficient Remote Management of Indian Antarctic Research Stations  
**Monitored Stations**: **MAITRI** & **BHARATI**

---

## 1. Dataset Architecture & Summary

The module is built on telemetry dataset `antarctic_station_2000_points-1.csv`:

* **Total Records**: 2,000 rows
* **Columns**: 14 telemetry features + anomaly label
* **Stations**: BHARATI (1,000 records), MAITRI (1,000 records)
* **Time Span**: 2026-01-01 00:00:00 to 2026-01-14 21:10:00 (~14 days)
* **Sampling Dynamics**: Telemetry records alternate every 10 minutes between stations, meaning consecutive observations for a single station are spaced **20 minutes** apart.
* **Label Distribution**: 1,990 normal points (99.5%), 10 anomaly points (0.5%).
* **Data Quality**: 0 missing values, 0 duplicate rows.
* **Simulated Telemetry Note**: This dataset represents synthetic/simulated telemetry specifically developed for hackathon prototyping; it is not direct operational NCPOR field telemetry.

### Telemetry Columns
| Column Name | Unit | Physical Description |
| :--- | :--- | :--- |
| `timestamp` | UTC Datetime | Reading timestamp |
| `station_id` | String | Station identifier (`BHARATI` or `MAITRI`) |
| `temperature_c` | °C | Ambient external Antarctic temperature |
| `wind_speed_mps` | m/s | External wind speed (converted to km/h in pipeline) |
| `humidity_percent` | % | Relative humidity |
| `power_consumption_kw` | kW | Station electrical power demand |
| `battery_level_percent` | % | Station backup battery charge level |
| `fuel_level_percent` | % | Station primary diesel tank reserve level |
| `water_level_percent` | % | Potable/station water tank reserve level |
| `generator_temperature_c` | °C | Main station diesel generator temperature |
| `generator_load_percent` | % | Generator mechanical load |
| `generator_rpm` | RPM | Generator rotational speed |
| `generator_status` | String | Operational status (`RUNNING`, `STANDBY`) |
| `anomaly` | Binary [0, 1] | Ground truth label (**NEVER** used in training) |

---

## 2. Most Important ML Rule — Unsupervised Integrity

> [!IMPORTANT]
> The `anomaly` column in the dataset is strictly reserved as an out-of-sample ground truth label for post-inference evaluation. It is **never** included as an input feature for feature engineering, Isolation Forest training, or Fuel forecasting. The primary anomaly detector is strictly **unsupervised**.

---

## 3. Rule-Based Features & Operational Signals

The module translates operational physical thresholds into deterministic binary flags and signed threshold margins:

### 3.1 Fuel Features
* `fuel_warning_flag`: Fuel < 30.0%
* `fuel_critical_flag`: Fuel < 15.0%
* `fuel_margin_to_warning`: `fuel_level_percent - 30.0`
* `fuel_margin_to_critical`: `fuel_level_percent - 15.0` (negative = breached)

### 3.2 Battery Features
* `battery_warning_flag`: Battery < 40.0%
* `battery_critical_flag`: Battery < 20.0%
* `battery_margin_to_warning`: `battery_level_percent - 40.0`
* `battery_margin_to_critical`: `battery_level_percent - 20.0`

### 3.3 Potable Water Features
* `water_warning_flag`: Water < 30.0%
* `water_critical_flag`: Water < 10.0%
* `water_margin_to_warning`: `water_level_percent - 30.0`
* `water_margin_to_critical`: `water_level_percent - 10.0`

### 3.4 Generator Temperature Features
* `generator_temp_warning_flag`: Temp > 80.0°C
* `generator_temp_critical_flag`: Temp > 90.0°C
* `generator_temp_margin_to_warning`: `80.0 - generator_temperature_c`
* `generator_temp_margin_to_critical`: `90.0 - generator_temperature_c` (negative = breached)

### 3.5 Wind Speed Features
* `wind_speed_kmh`: `wind_speed_mps * 3.6` (converted before comparison)
* `wind_warning_flag`: Wind > 60.0 km/h
* `wind_critical_flag`: Wind > 100.0 km/h
* `wind_margin_to_warning`: `60.0 - wind_speed_kmh`
* `wind_margin_to_critical`: `100.0 - wind_speed_kmh`

### 3.6 Power Consumption Features
* Configurable Station Capacity: `STATION_POWER_CAPACITY_KW = {"BHARATI": 800.0, "MAITRI": 800.0}`
* `power_utilization_percent`: `(power_consumption_kw / capacity_kw) * 100.0`
* `power_warning_flag`: Power utilization > 85.0%
* `power_critical_flag`: Power utilization > 95.0%
* `power_margin_to_warning`: `85.0 - power_utilization_percent`
* `power_margin_to_critical`: `95.0 - power_utilization_percent`

### 3.7 Ambient Temperature Features
* `temp_warning_flag`: Temp < -40.0°C or Temp > 5.0°C
* `temp_critical_flag`: Temp < -50.0°C
* `temp_low_extreme_flag`: Temp < -40.0°C
* `temp_high_extreme_flag`: Temp > 5.0°C

### 3.8 Generator Status Normalization & Cross-Sensor Consistency
* Normalization: `RUNNING` -> 0, `STANDBY` -> 1, `OFF`/`FAILURE` -> 2
* `generator_off_high_load`: Generator in standby/off with load > 75%
* `generator_off_nonzero_rpm`: Generator in standby/off with RPM > 100
* `generator_high_temp_high_load`: Generator temp > 80°C and load > 75%
* `generator_high_load_high_power`: Generator load > 75% and power utilization > 85%

---

## 4. Time-Series Feature Engineering

To prevent inter-station boundary leakage, all lag, rolling, and delta transformations are calculated **strictly partitioned by `station_id`**:

1. **Station Sorting**: `df.sort_values(["station_id", "timestamp"])`
2. **Temporal Features**: `hour`, `day_of_week`, `day`, with cyclical encodings `hour_sin`, `hour_cos`, `day_of_week_sin`, `day_of_week_cos`.
3. **Rates & Deltas**:
   - Station-wise differences: `fuel_delta`, `power_delta`, `generator_temp_delta`, etc.
   - `time_delta_hours`: Computed from timestamp differences (handles 0/NaN safely).
   - `fuel_consumption_rate`: `-(fuel_delta / time_delta_hours)` (positive = fuel consumed).
4. **Rolling Windows (1h = 3 steps, 3h = 9 steps)**:
   - Rolling mean and std for power, fuel, generator temp, generator load, ambient temp, wind.
5. **Deviations & Z-scores**:
   - `power_deviation = power_kw - power_1h_mean`
   - `generator_temp_deviation = gen_temp - gen_temp_1h_mean`
   - Protected rolling z-scores (`deviation / (std + 1e-4)`).
6. **Station Lags**:
   - Lags at 1 step (20 min), 3 steps (1 hour), and 6 steps (2 hours) for key drivers.

---

## 5. Model 1: Isolation Forest (Anomaly Detection)

* **Algorithm**: `sklearn.ensemble.IsolationForest`
* **Estimators**: 200 trees
* **Contamination**: 0.01 (tuned on validation set)
* **Features Selected**: 39 curated operational and physical features (raw sensors, rates, deviations, z-scores, rule flags).
* **Calibration**: Decision threshold calibrated on chronological validation split using candidate percentile sweep.
* **Results**:
  - Full Dataset: **Recall 90.0%** (9 of 10 ground truth anomalies detected)
  - Mean anomaly score for normal telemetry: `+0.1085`
  - Mean anomaly score for operational anomalies: `+0.0233`
  - Significant negative drift during degradation events.

---

## 6. Model 2: RandomForestRegressor (Fuel Prediction)

* **Algorithm**: `sklearn.ensemble.RandomForestRegressor`
* **Estimators**: 200 trees, `max_depth=12`
* **Forecast Horizon**: 1 hour ahead (3 steps of 20 minutes)
* **Target Formulation**: Models consumption delta `target_future_fuel_consumption = current_fuel - future_fuel` to maintain stationary physics and prevent decision tree extrapolation errors on trending time-series.
* **Evaluation & Baseline Comparison**:
  - **Test Split Model MAE**: **1.55%**
  - **Persistence Baseline MAE**: **1.66%**
  - **Performance**: **6.24% MAE improvement** over baseline on test split, and **11.81% improvement** on validation split!

---

## 7. Chronological Splitting & Evaluation Methodology

Data is split chronologically per station:
* **Training Set**: First 70% (1,400 records) — Jan 1 to Jan 10
* **Validation Set**: Next 15% (300 records) — Jan 11 to Jan 12 (Threshold tuning & hyperparameter validation)
* **Test Set**: Final 15% (300 records) — Jan 13 to Jan 14 (Strictly held-out out-of-sample evaluation)

---

## 8. Integration: Rule Engine vs ML Engine

```text
                     RAW TELEMETRY
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
        RULE ENGINE                 ML ENGINE
   (Deterministic Rules)     (Feature Engineering)
              │                         │
      Known threshold            ┌──────┴──────┐
        violations               ▼             ▼
              │          Isolation Forest  Random Forest
              │           Anomaly Detector  Fuel Regressor
              │                  │             │
              ▼                  ▼             ▼
       Alert: CRITICAL/      ML Anomaly    Fuel Forecast
       WARNING/RECOVERY        Score      (1h Ahead Level)
              │                  │             │
              └────────────┬─────┴─────────────┘
                           │
                           ▼
                      ALERT ENGINE
                           │
                           ▼
                    POLAR DASHBOARD
```

The deterministic **Rule Engine** answers: *"Did a sensor violate hard physical safety limits right now?"*  
The **ML Engine** answers: *"Does the multi-sensor correlation look abnormal compared to normal station history?"* and *"What will fuel reserves be in 1 hour?"*

---

## 9. Real-Time Streaming Inference Usage

```python
from ml.src.inference import run_ml_inference

reading = {
    "timestamp": "2026-01-16 12:00:00",
    "station_id": "BHARATI",
    "temperature_c": -23.5,
    "wind_speed_mps": 11.2,
    "humidity_percent": 64.0,
    "power_consumption_kw": 380.0,
    "battery_level_percent": 86.0,
    "fuel_level_percent": 82.0,
    "water_level_percent": 78.0,
    "generator_temperature_c": 74.0,
    "generator_load_percent": 52.0,
    "generator_rpm": 1500,
    "generator_status": "RUNNING",
}

result = run_ml_inference(reading)
print(result)
```

Output:
```json
{
  "station_id": "BHARATI",
  "timestamp": "2026-01-16 12:00:00",
  "anomaly": false,
  "anomaly_score": 0.1643,
  "predicted_fuel_consumption_rate": 0.25,
  "predicted_future_fuel_level": 81.75,
  "predicted_1h_fuel_consumption": 0.25,
  "rule_signals": {
    "fuel_warning": false,
    "fuel_critical": false,
    "generator_temp_critical": false
  },
  "threshold_margins": {
    "fuel_margin_to_critical": 67.0,
    "generator_temp_margin_to_critical": 16.0
  },
  "model_version": "v1.0.0"
}
```

---

## 10. How to Run & Retrain

### Install Dependencies
```bash
pip install -r ml/requirements.txt
```

### Run Full Test Suite
```bash
python -m pytest -v ml/tests
```

### Retrain Models and Export Artifacts
```bash
python -m ml.src.train_and_evaluate
```

### Run Live 4-Phase Demo Scenario
```bash
python -m ml.src.demo_scenario
```

### Generate Visualization Plots
```bash
python -m ml.notebooks.generate_eda_charts
```

---

## 11. Model Limitations & Next Steps

1. **Dataset Scope**: The dataset spans ~14 days of synthetic telemetry. Long-term seasonal Antarctic operational cycles (months/years) cannot be learned from two weeks.
2. **Label Scarcity**: Ground truth contains only 10 labelled failures. In production, ongoing operational logging with operator-in-the-loop labels is required.
3. **Threshold Calibration**: Operational limits (e.g. 800 kW nominal capacity) are configured prototype parameters and should be calibrated with real station engineering specifications.
4. **Next Steps**:
   - Integration with Antarctic AWS (Automatic Weather Station) live feeds.
   - Dynamic battery state-of-health (SoH) and generator vibration frequency modeling.
   - Low-power edge deployment on station gateway devices.
