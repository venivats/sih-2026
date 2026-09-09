# Three-minute evaluator demonstration

**0:00–0:25 — State the boundary.** “POLARIS is our independent SIH26060 prototype for remote management of Maitri and Bharati. The station equipment and telemetry shown here are explicitly simulated. We have no government endorsement or live station-control connection.” Point to the workspace and historical time labels.

**0:25–0:55 — Inspect the twin.** Show the overview’s ice schematic and dark asset inspector. Click the primary generator and switch between Evidence, Impact and Action. Show the triggering coolant measurement, its observation and ingestion times, source classification and documented rule. Explain upstream fuel and downstream electrical/heat dependencies. Show the standby path as an assumption, not verified redundancy.

**0:55–1:45 — Complete an action.** Use Run demo exercise → Primary generator overheat → Run private exercise. Show 94 °C with its historical timestamp. Review incident. Acknowledge the alert, assign a work order to “Station engineer”, allocate a coolant filter, start work, use the allocated filter, and resolve with “Cooling filter replaced in this engineering demonstration; sensor recovery still requires a new reading.” Show stock reduced in Logistics and the linked audit event. Point out that the sensor remains unrecovered. Use Run demo exercise → Test sensor recovery and show that sensor recovery is separately recorded.

**1:45–2:15 — Explain resource planning.** Open Energy & resources. Show the assumed planning target, burn sensitivity, and fuel-ledger reconciliation; trace the input evidence. Open What-if workspace, select primary generator failure, increase demand, set backup to 180 kW, and run. Show the calculated shortfall, dependencies and resupply horizon. Explain that these are deterministic assumptions, not validated forecasts.

**2:15–2:45 — Prove data honesty.** Open Environment → NASA POWER sample. Show the genuine 1–7 January 2024 grid data, label “reanalysis”, and historical replay. Open Data & evidence, download the original and manifest. Explain why checksums establish integrity rather than scientific authenticity. Contrast with the unacquired NCPOR candidates.

**2:45–3:00 — Explain delivery.** “The public version runs private browser demonstrations. The repository also contains the FastAPI/PostgreSQL implementation, migrations, import validation and tested workflow. Persistent backend deployment requires a suitable hosting account and verified durable resources. We do not claim operational Antarctic validation.”
