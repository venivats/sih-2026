"""Final Demo Scenario for PolarOps ML Engine (SIH26060).

Demonstrates real-time telemetry streaming through four operational phases:
1. NORMAL STATION: Normal sensor telemetry -> ML normal, Rules green.
2. DEGRADING CONDITIONS: Generator temp & power drift -> ML anomaly score decreases (more anomalous).
3. CRITICAL CONDITION: Fuel breaches critical threshold (<15%) -> Rule CRITICAL + ML anomaly.
4. RECOVERY: Fuel replenished, generator temp normalized -> Signals recover to safe normal.
"""

from datetime import datetime, timedelta
import json
import logging
from typing import Any, Dict, List
from ml.src.inference import MLInferenceEngine

logger = logging.getLogger("PolarOps-Demo")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


def run_demo_scenario() -> List[Dict[str, Any]]:
    """Simulate the 4-stage operational degradation and recovery scenario."""
    engine = MLInferenceEngine()
    engine.clear_buffers()

    station = "BHARATI"
    base_time = datetime(2026, 1, 15, 12, 0, 0)
    step_minutes = 20

    scenarios = [
        {
            "phase": "1. NORMAL STATION",
            "description": "Station operating in equilibrium. Nominal load, comfortable temperatures.",
            "data": {
                "station_id": station,
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
            },
        },
        {
            "phase": "2. DEGRADING CONDITIONS",
            "description": "Sub-threshold multi-sensor drift: generator overheating to 88°C, electrical power surging.",
            "data": {
                "station_id": station,
                "temperature_c": -28.0,
                "wind_speed_mps": 18.5,
                "humidity_percent": 75.0,
                "power_consumption_kw": 660.0,
                "battery_level_percent": 72.0,
                "fuel_level_percent": 55.0,
                "water_level_percent": 74.0,
                "generator_temperature_c": 88.5,  # Exceeding warning (>80), approaching critical (>90)
                "generator_load_percent": 86.0,
                "generator_rpm": 1520,
                "generator_status": "RUNNING",
            },
        },
        {
            "phase": "3. CRITICAL CONDITION",
            "description": "Critical threshold breach: fuel level drops to 12% (< 15% critical threshold), generator at 98°C.",
            "data": {
                "station_id": station,
                "temperature_c": -33.0,
                "wind_speed_mps": 24.0,
                "humidity_percent": 80.0,
                "power_consumption_kw": 770.0,
                "battery_level_percent": 35.0,  # Warning (< 40%)
                "fuel_level_percent": 12.0,     # CRITICAL (< 15%)
                "water_level_percent": 70.0,
                "generator_temperature_c": 98.0, # CRITICAL (> 90°C)
                "generator_load_percent": 94.0,
                "generator_rpm": 1535,
                "generator_status": "RUNNING",
            },
        },
        {
            "phase": "4. RECOVERY",
            "description": "Fuel replenished to 85%, auxiliary cooling restored generator temp to 73°C.",
            "data": {
                "station_id": station,
                "temperature_c": -22.0,
                "wind_speed_mps": 10.5,
                "humidity_percent": 62.0,
                "power_consumption_kw": 370.0,
                "battery_level_percent": 88.0,
                "fuel_level_percent": 85.0,      # Restored
                "water_level_percent": 79.0,
                "generator_temperature_c": 73.0, # Restored
                "generator_load_percent": 50.0,
                "generator_rpm": 1500,
                "generator_status": "RUNNING",
            },
        },
    ]

    results = []

    print("\n" + "=" * 75)
    print("POLAROPS ML ENGINE - LIVE DEMO SCENARIO (4-PHASE PROGRESSION)")
    print("=" * 75)

    for i, step in enumerate(scenarios):
        current_ts = base_time + timedelta(minutes=step_minutes * i)
        payload = dict(step["data"])
        payload["timestamp"] = current_ts.strftime("%Y-%m-%d %H:%M:%S")

        output = engine.run_ml_inference(payload)
        stage_report = {
            "phase": step["phase"],
            "description": step["description"],
            "timestamp": payload["timestamp"],
            "ml_anomaly": output["anomaly"],
            "ml_anomaly_score": output["anomaly_score"],
            "predicted_future_fuel_level": output["predicted_future_fuel_level"],
            "rule_signals": output["rule_signals"],
            "threshold_margins": output["threshold_margins"],
        }
        results.append(stage_report)

        print(f"\n>>> [{step['phase']}] - {payload['timestamp']}")
        print(f"    Scenario: {step['description']}")
        print(f"    [ML Engine]   Anomaly Detected: {output['anomaly']} | Anomaly Score: {output['anomaly_score']:+.4f}")
        print(f"    [Fuel Model]  Current Fuel: {payload['fuel_level_percent']}% -> Predicted 1h Ahead: {output['predicted_future_fuel_level']}%")
        print(f"    [Rule Signal] Fuel Critical: {output['rule_signals']['fuel_critical']} (Margin: {output['threshold_margins']['fuel_margin_to_critical']}%)")
        print(f"    [Rule Signal] Gen Temp Critical: {output['rule_signals']['generator_temp_critical']} (Margin: {output['threshold_margins']['generator_temp_margin_to_critical']}°C)")

    print("\n" + "=" * 75)
    print("DEMO SCENARIO COMPLETED SUCCESSFULLY")
    print("=" * 75)
    return results


if __name__ == "__main__":
    run_demo_scenario()
