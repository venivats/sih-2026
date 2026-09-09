"""Generate comprehensive EDA and model evaluation visualization charts for PolarOps."""

from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from ml.src.anomaly_detection import AnomalyDetector
from ml.src.config import BASE_DIR
from ml.src.data_loader import load_and_validate_telemetry
from ml.src.evaluation import create_chronological_station_splits
from ml.src.feature_engineering import (
    FUEL_REGRESSOR_FEATURES,
    IFOREST_FEATURES,
    build_full_feature_pipeline,
)
from ml.src.fuel_prediction import FuelPredictor

PLOTS_DIR = BASE_DIR / "notebooks" / "plots"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

# Plot styling
plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
plt.rcParams["font.sans-serif"] = "Arial"
plt.rcParams["figure.dpi"] = 150


def generate_all_plots():
    print("Loading data for visualization...")
    df_raw, _ = load_and_validate_telemetry()
    df_feat = build_full_feature_pipeline(df_raw, include_future_target=True)
    train_df, val_df, test_df = create_chronological_station_splits(df_feat)

    detector = AnomalyDetector.load()
    fuel_model = FuelPredictor.load()

    # Predictions
    preds_full, scores_full = detector.predict(df_feat)
    df_feat["ml_anomaly_pred"] = preds_full
    df_feat["ml_anomaly_score"] = scores_full

    valid_test = test_df.dropna(subset=["target_future_fuel_level"]).copy()
    test_pred_level = fuel_model.predict(valid_test)
    valid_test["pred_fuel_level"] = test_pred_level
    valid_test["fuel_error"] = valid_test["target_future_fuel_level"] - test_pred_level

    # =========================================================================
    # 1. EDA SENSOR TIME-SERIES OVERVIEW
    # =========================================================================
    print("1. Generating EDA Sensor Overview...")
    fig, axes = plt.subplots(3, 2, figsize=(15, 10), sharex=True)

    stations = ["BHARATI", "MAITRI"]
    colors = {"BHARATI": "#1f77b4", "MAITRI": "#ff7f0e"}

    sensors = [
        ("temperature_c", "Ambient Temperature (°C)", axes[0, 0]),
        ("fuel_level_percent", "Fuel Level (%)", axes[0, 1]),
        ("power_consumption_kw", "Power Consumption (kW)", axes[1, 0]),
        ("battery_level_percent", "Battery Level (%)", axes[1, 1]),
        ("generator_temperature_c", "Generator Temperature (°C)", axes[2, 0]),
        ("wind_speed_kmh", "Wind Speed (km/h)", axes[2, 1]),
    ]

    for st in stations:
        sub = df_feat[df_feat["station_id"] == st]
        for col, title, ax in sensors:
            ax.plot(sub["timestamp"], sub[col], label=st, color=colors[st], alpha=0.8, lw=1.2)
            ax.set_title(title, fontsize=11, fontweight="bold")
            ax.grid(True, alpha=0.3)

    axes[0, 0].legend(loc="upper right")
    fig.suptitle("PolarOps: Indian Antarctic Research Stations Telemetry (14 Days)", fontsize=14, fontweight="bold", y=0.99)
    plt.tight_layout()
    plot1_path = PLOTS_DIR / "eda_telemetry_overview.png"
    plt.savefig(plot1_path)
    plt.close()
    print(f"   Saved: {plot1_path}")

    # =========================================================================
    # 2. ANOMALY DETECTION VISUALIZATION
    # =========================================================================
    print("2. Generating Anomaly Detection Plots...")
    fig, axes = plt.subplots(2, 2, figsize=(15, 9))

    # A: Anomaly Score Distribution (Normal vs Ground Truth Anomalies)
    ax = axes[0, 0]
    sns.kdeplot(df_feat.loc[df_feat["anomaly"] == 0, "ml_anomaly_score"], ax=ax, label="Normal Telemetry", fill=True, color="#2ca02c")
    sns.kdeplot(df_feat.loc[df_feat["anomaly"] == 1, "ml_anomaly_score"], ax=ax, label="Ground Truth Anomalies", fill=True, color="#d62728")
    ax.axvline(detector.decision_threshold, color="black", linestyle="--", label=f"Threshold ({detector.decision_threshold:.3f})")
    ax.set_title("Isolation Forest Decision Score Distribution", fontweight="bold")
    ax.set_xlabel("Anomaly Score (Lower = More Anomalous)")
    ax.legend()

    # B: Labeled vs Predicted Anomalies Over Time
    ax = axes[0, 1]
    ax.scatter(df_feat["timestamp"], df_feat["generator_temperature_c"], c=df_feat["ml_anomaly_pred"], cmap="coolwarm", s=15, alpha=0.7, label="ML Prediction")
    gt_anoms = df_feat[df_feat["anomaly"] == 1]
    ax.scatter(gt_anoms["timestamp"], gt_anoms["generator_temperature_c"], facecolors="none", edgecolors="black", s=80, lw=1.8, label="Ground Truth Anomaly")
    ax.set_title("Generator Temperature Anomalies (Predicted vs Ground Truth)", fontweight="bold")
    ax.set_ylabel("Generator Temp (°C)")
    ax.legend()

    # C: Anomaly Count by Station
    ax = axes[1, 0]
    anom_counts = pd.DataFrame({
        "Ground Truth": df_feat.groupby("station_id")["anomaly"].sum(),
        "ML Predicted": df_feat.groupby("station_id")["ml_anomaly_pred"].sum(),
    })
    anom_counts.plot(kind="bar", ax=ax, color=["#1f77b4", "#d62728"], rot=0)
    ax.set_title("Anomaly Detections by Research Station", fontweight="bold")
    ax.set_ylabel("Count")

    # D: Power Anomalies
    ax = axes[1, 1]
    ax.scatter(df_feat["timestamp"], df_feat["power_consumption_kw"], c=df_feat["ml_anomaly_pred"], cmap="coolwarm", s=15, alpha=0.7)
    ax.scatter(gt_anoms["timestamp"], gt_anoms["power_consumption_kw"], facecolors="none", edgecolors="black", s=80, lw=1.8, label="Ground Truth Anomaly")
    ax.axhline(680, color="orange", linestyle=":", label="Warning Threshold (85%)")
    ax.axhline(760, color="red", linestyle="--", label="Critical Threshold (95%)")
    ax.set_title("Electrical Power Consumption Anomalies", fontweight="bold")
    ax.set_ylabel("Power (kW)")
    ax.legend(loc="upper left")

    plt.tight_layout()
    plot2_path = PLOTS_DIR / "anomaly_detection_analysis.png"
    plt.savefig(plot2_path)
    plt.close()
    print(f"   Saved: {plot2_path}")

    # =========================================================================
    # 3. FUEL PREDICTION VISUALIZATION
    # =========================================================================
    print("3. Generating Fuel Prediction Plots...")
    fig, axes = plt.subplots(2, 2, figsize=(15, 9))

    # A: Actual vs Predicted Fuel on Test Set
    ax = axes[0, 0]
    for st in stations:
        st_sub = valid_test[valid_test["station_id"] == st]
        ax.plot(st_sub["timestamp"], st_sub["target_future_fuel_level"], label=f"{st} Actual (1h Ahead)", lw=1.5)
        ax.plot(st_sub["timestamp"], st_sub["pred_fuel_level"], label=f"{st} RF Predicted", linestyle="--", lw=1.5)
    ax.set_title("Actual vs Predicted Future Fuel Level (Test Split)", fontweight="bold")
    ax.set_ylabel("Fuel Level (%)")
    ax.legend()

    # B: Scatter parity plot
    ax = axes[0, 1]
    ax.scatter(valid_test["target_future_fuel_level"], valid_test["pred_fuel_level"], alpha=0.6, color="#1f77b4", s=25)
    lims = [valid_test["target_future_fuel_level"].min() - 1, valid_test["target_future_fuel_level"].max() + 1]
    ax.plot(lims, lims, "r--", lw=1.5, label="Perfect Forecast (1:1)")
    ax.set_xlim(lims)
    ax.set_ylim(lims)
    ax.set_title("Prediction Parity Plot (Actual vs Forecast)", fontweight="bold")
    ax.set_xlabel("Actual Fuel (1h Ahead %)")
    ax.set_ylabel("Predicted Fuel (1h Ahead %)")
    ax.legend()

    # C: Fuel Consumption Rate over time
    ax = axes[1, 0]
    for st in stations:
        st_sub = df_feat[df_feat["station_id"] == st]
        ax.plot(st_sub["timestamp"], st_sub["fuel_consumption_rate"], label=st, alpha=0.7, lw=1.0)
    ax.set_title("Historical Fuel Consumption Rate over Time", fontweight="bold")
    ax.set_ylabel("Consumption Rate (%/hr)")
    ax.set_ylim([-2, 10])
    ax.legend()

    # D: Prediction Error Distribution
    ax = axes[1, 1]
    sns.histplot(valid_test["fuel_error"], kde=True, ax=ax, color="#9467bd", bins=20)
    ax.axvline(0, color="black", linestyle="--")
    ax.set_title(f"Fuel Forecast Error Distribution (MAE: {np.mean(np.abs(valid_test['fuel_error'])):.2f}%)", fontweight="bold")
    ax.set_xlabel("Forecast Error: Actual - Predicted (%)")

    plt.tight_layout()
    plot3_path = PLOTS_DIR / "fuel_prediction_analysis.png"
    plt.savefig(plot3_path)
    plt.close()
    print(f"   Saved: {plot3_path}")
    print("All charts generated successfully!")


if __name__ == "__main__":
    generate_all_plots()
