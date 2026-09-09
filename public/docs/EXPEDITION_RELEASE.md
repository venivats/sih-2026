# POLARIS Expedition release — 9 September 2026
Independent SIH26060 prototype. No government endorsement or operational validation.

## What the team can demonstrate

| Area | New behaviour | Evidence / limit |
|---|---|---|
| Navigation | Ten addressable station pages, breadcrumbs, Back/Forward, direct asset/incident/shipment addresses | Private workspace identifiers stay in tab storage, not shareable URLs. A recipient opens their own session. |
| Appearance | Persistent dark/light/system modes, wider navigation, responsive layouts, operator/scientist starting views | Perspective is a presentation preference, not authorization. Motion respects reduced-motion settings. |
| Antarctic context | Credited NASA landscape, historical Maitri photograph and projected map of both stations | Landscape is West Antarctica, not a station survey. Maitri photograph is from 2005. |
| Equipment | Functional equipment identity in both inspectors | Manufacturer/model remains unverified until supported by a station specification. |
| Priorities | Ranked decisions with explicit score, ownership and record drill-down | Heuristic priority, not probability or official procedure. |
| Resupply | Shipment date minus fuel-burn baseline, fuel at arrival, reserve margin and delay sensitivity | One shared fuel ledger. Constant burn and unchanged ETA are assumptions. |
| People | Register/edit crew duty periods; assign unresolved work subject to availability | Fictional private-demo records; operational records require backend roles. |
| Outdoor work | Register tasks, responsible crew, shipment links, configurable wind threshold and review status | Unavailable/questionable/stale weather stays unassessable. A low wind value is not safety clearance. |
| Contacts | Planned contact register, next scheduled session, owner and completion/missed status | Human-entered schedule, not satellite ephemerides or measured link availability. |
| Handover | Generate, inspect, export and save immutable reviewed reports with frozen record inputs | Deterministic narrative; no model API or external data transmission. |
| Station questions | Fuel, energy, resupply, weather, alerts and handover answers with evidence IDs | Supported intents only; unsupported questions admit absent evidence. No general chatbot or approved procedures. |
| Scientific models | Surviving backup path/capacity, response comparison, thermal-loss sensitivity | Simple declared models; no protection coordination, calibrated building physics or validated prediction. |
| Research continuity | Register research/service dependencies, owners and declared interruption tolerance | No actual experiments or tolerances are invented. |
| Quality & replay | Read-only flags, synthetic statistical benchmark, historical alert/audit replay | Originals stay untouched. Benchmark metrics describe synthetic samples only. |

## Connected evaluator exercise
1. Open **Station overview** and show the visible historical/demo labels. Follow the fuel decision into **Logistics** and inspect the shipment date and calculated shortfall.
2. Start a private demo. Under **People & operations**, register a fictional engineer with a duty period covering the work-order due date.
3. Register an outdoor fuel-transfer task, select that engineer and the demonstration shipment, and document the assumed wind threshold. Toggle the 130 km/h storm assumption: review status changes without changing the task or ETA. Explicitly open the +45-day delay analysis.
4. In **Alerts & maintenance**, acknowledge the generator alert and create an order. Assign it from the crew register. Allocate/use a spare and resolve with notes; sensor recovery remains separate.
5. In **Scientific workspace**, compare generator and distribution-board failures, inspect the thermal equation, then locate both stations on the geographic map. Register a fictional research dependency if useful.
6. Generate and save a handover, reload, reopen it and export its frozen inputs. Ask about fuel and inspect the cited records.

## Deployment boundary
The published browser demo saves private changes in the current tab's session storage. Reloading the same private URL restores them; closing the tab may remove them. Use the report download for portable evidence. It is not shared durable storage and does not queue offline writes.

The repository includes the protected FastAPI endpoints and additive Alembic migration **0004_operations** for persistent crew, task, contact, research and handover records. Run `alembic upgrade head` through the existing Windows or Docker instructions after a backup. No existing records are replaced. The prepared FastAPI/PostgreSQL/storage deployment still needs the selected hosting account and approval of any charges.

## Scientific assumptions
- Wind review accepts station observations, or explicitly synthetic readings in demonstration mode, with a two-hour age limit relative to the workspace clock. Reanalysis/forecasts do not silently become station observations.
- Resupply horizon begins at the displayed fuel-burn observation baseline. It is a historical planning calculation, not a continuously measured depletion estimate.
- Capacity inspection traverses registered electricity paths, removes the selected failed asset and applies derating to known kW ratings. Unspecified path ratings are assumed non-limiting. One path ceiling does not prove that multiple simultaneous loads can be supplied.
- Thermal time is `C/H × ln((Tin − Tout)/(Ttarget − Tout))`, with constant ambient, no heat input and one effective thermal mass. The ±20% heat-loss range is sensitivity, not statistical confidence.
- Quality screening uses declared heuristics: missing/duplicate timestamps, physical percentage range, median-cadence gaps, rapid temperature change and repeated values. No screen proves scientific authenticity.
- The anomaly comparison trains a mean/deviation baseline on the first 80 deterministic synthetic samples and evaluates 40 later samples with four declared injected deviations. It is not Antarctic ML validation.

## Remaining work
Host and verify the persistent backend, PostgreSQL contention and managed restore; validate mobile browser layouts; obtain actual station equipment and topology evidence, calibrated thermal parameters, approved operating thresholds and authenticated operational sources. Model-assisted writing can be added behind server credentials later, but the application remains usable without it. Durable offline queuing, binary deltas, satellite pass prediction and autonomous controls are not implemented.
