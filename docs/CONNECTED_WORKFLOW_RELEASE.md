# POLARIS connected workflow release — 25 September 2026

## What changed

The default station overview is now a briefing: incidents to review, unresolved work, field assignments needing attention and recorded fuel coverage. The detailed systems view remains available in a separate overview tab.

“Explore a station incident” creates a fresh isolated demonstration and opens a dedicated incident page. Its guide follows warning review, work assignment, field inspection, resolution and saved handover. Acknowledgement, work completion and sensor recovery remain separate events.

Crew & field map links a roster member, an asset, an optional work order, an assigned area and a check-in deadline. It shows reported position accuracy, observation time, receipt time, boundary uncertainty, location breaches and stale positions. Contact attempts, inspections and SOS records are append-only evidence. The focused Field task view puts the assignment and update form first. Multiple assignments can be created from existing on-duty roster records.

What-if workspace now compares recorded fuel consumption with an explicit alternative, arrival delay and reserve. A named comparison saves its input snapshot and can be exported as JSON. Changing an assumption does not change operational measurements, inventory or shipments.

Calculation panels consistently expose formulas, inputs, timestamps, assumptions and record links. Handovers preserve their inputs and identify changes since the previous saved shift, including work, stock movements, alerts, shipments and field events. Incident replay presents recorded events without changing them.

## Team demonstration (about three minutes)

1. Open Station overview → Station briefing. Explain: “POLARIS connects a warning to evidence, responsible work and a preserved handover.” Select **Explore a station incident**. The new private demonstration does not overwrite an earlier one.
2. On the incident page, inspect the trigger and its dependencies. Acknowledge the warning and create a work order with an assignee and due date. These are explicit actions; an alert does not establish a confirmed equipment failure.
3. Select **Crew & field assignment**, then **Create fictional field assignment**. The sample links to an unresolved GEN-A work order if one exists. If needed, open **Exercise controls & configured work area**, choose that work order and save the revision.
4. Demonstrate **Simulate boundary uncertainty**, then **Simulate zone breach**. Explain that a reported uncertainty circle crossing the boundary produces review; a circle fully outside the assigned area establishes the configured breach. Neither result is medical or operational safety clearance.
5. Choose **Inspection note**, enter what was inspected and save. Open the linked work order, start it and resolve it with a specific note. Show that resolving work does not fabricate a sensor recovery reading. The existing Exercise console can explicitly inject a qualifying simulated recovery if desired.
6. Select **Save handover** in the guide. Generate and save the report. Open its preserved input snapshot. A second handover compares against that saved baseline.

Optional extension: in What-if workspace, enter alternative consumption and an arrival delay, explain the two calculations, and save a named comparison. The result is a constant-consumption calculation, not a learned forecast or an approved load-shedding plan.

For the stale-location demonstration, stop sending updates for more than two minutes. The location becomes unknown and the marker is labelled last known. Sending an older delayed position does not replace a newer observation. Check-in deadlines and unresolved SOS records are evaluated independently of location.

## Boundaries for presentations

- All new crew coordinates, map geometry and zone limits are illustrative local offsets in metres. No GPS/GNSS tracker, surveyed Antarctic map or physical laboratory sensor is connected.
- A physical sensor demonstration still requires a device, its documented location and a reviewed authenticated ingestion path. The current Antarctic station routes must not be used to mislabel a laboratory reading as Antarctic telemetry.
- The 2-minute position freshness limit and 20 m boundary-review buffer are prototype assumptions, not station procedures.
- “Within assigned area” is a position classification, not a safety guarantee. A zone breach is separate from SOS. Recording SOS does not dispatch assistance or send a message.
- A check-in is associated with the displayed deadline. It can satisfy that deadline early. A new deadline requires a new check-in.
- Unsurveyed field plans and simulated positions are rejected in the operational workspace by the backend. Existing station/workspace/role access controls apply to every new record.
- Field events, positions, comparisons and handovers are immutable. Plans use version checks to reject stale edits.
- Offline writes are disabled. No durable write queue or conflict-free offline synchronization is claimed. Existing loaded records can remain visible while disconnected; a reload without a connection may be unavailable.
- In browser-only mode, each private demonstration is stored separately in the current browser tab. Connected private-demo credentials survive a reload only in that tab and retain the server's existing expiry. Operational credentials are not persisted by this change.
- The official weather archive and existing scientific models retain their previous source and validation labels.

## Verification and release status

Local checks:

```sh
.venv/bin/python -m pytest backend/tests -q
node --test tests/models.test.mjs tests/browser-state.test.mjs
VITE_API_BASE_URL=/api npm run build
```

The backend suite passes 33 tests, including database migration/restart persistence, existing two-user access checks, field evidence isolation, timestamp validation, idempotency and immutability. One PostgreSQL concurrency test is skipped because no disposable `TEST_POSTGRES_URL` database is available.

The model and browser-storage adapter suites pass 14 tests. They include location uncertainty and staleness, early check-ins and changed deadlines, SOS independence, unchanged source data, frozen handovers and the complete isolated inspection-to-handover flow. These are automated logic tests, not visual browser tests.

A production build targeting the same-origin `/api` backend passes. No database migration is needed: the new record types use the existing scoped operations table.

Pending gates: visual desktop/mobile checks in light and dark themes; keyboard/dialog review in the running release; PostgreSQL concurrency validation; live Render deployment and persistence verification. The current execution environment rejects the network permission needed for browser access to the local preview. Render also requires explicit user selection of its workspace before its management tools can be used. No live deployment is claimed by this document.

The release is prepared on a feature branch so the live version can remain available until these gates are completed. Existing Render database, storage, credentials and account configuration are not changed.
