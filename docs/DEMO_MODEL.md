# Engineering demonstration model
Independent SIH26060 prototype; not an operationally validated Antarctic system.

## Time and origin
Telemetry is a deterministic simulation covering 5 September 2026 00:00 UTC to 6 September 2026 00:00 UTC. Temperatures, power and resources are not measurements from NCPOR or another station provider. Two environmental temperature samples intentionally remain null. Sensor exercises append explicitly simulated readings one hour after the previous sample; advancing time does not make a series live.

## Illustrative assets and assumptions
- Main generator nameplate example: 250 kW (Maitri); Bharati demo should use 280 kW to accommodate its example generation. Backup generator 180 kW.
- Battery nameplate: 120 kWh, sample SoC 78%; no measured efficiency or usable-capacity validation.
- Fuel store, primary and standby generators, bus, battery, HVAC, water treatment, communications and essential loads are database records. Edges describe illustrative fuel, electrical and heat dependencies. Paths are not surveyed infrastructure.
- Example cooling alert: two consecutive samples above 90 °C open an alert. A value at or below 85 °C recovers the sensor state. Intermediate readings reset the high streak but do not recover the fault. A late reading does not reevaluate a newer rule state. Null resets the streak and does not signal recovery.
- Alert acknowledgement is human workflow state. Work-order resolution requires notes and does not mark the sensor recovered.

## Resource equations
- Power balance = generation − consumption at the same timestamp.
- Fuel autonomy = current fuel inventory / last recorded daily fuel burn. This assumes constant consumption and omits inaccessible stock and reserves. Historical burn can be stale.
- Battery energy = assumed nameplate capacity × SoC / 100. This omits depth-of-discharge, conversion losses, degradation and availability.
- Scenario demand = max(0, baseline demand × (1 + additional demand fraction + weather increment) − shed kW).
- Scenario supply = user-assumed backup kW for a main-generator failure; otherwise recorded generation.
- Power shortfall = max(0, scenario demand − supply).
- Scenario burn = baseline burn × scenario demand / baseline demand. Fuel use describes required demand, even if supply is insufficient; it does not model actual dispatch under unmet demand.
- Fuel at horizon = baseline stock − scenario burn × delay days. A negative result is an unmet-resource amount, not a negative inventory transaction.
- Severe-weather option adds an explicitly assumed 15% load. Communications and heating effects are reachability illustrations, without a thermodynamic or reliability model.

Scenarios are pure calculations. They never write to assets, measurements, inventory, alerts or work orders. Browser comparisons store explicit inputs/results in sessionStorage. No 3D view or generative AI is included because neither is required to demonstrate the core workflow.
