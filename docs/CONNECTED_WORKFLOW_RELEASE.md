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

PR #4 was merged into `main` as `43a4c68269566f9a600fba8c29724e1bf1b38eef`. Render deployment `dep-dar7a3nlk1mc73d7fph0` became live on 25 September 2026 at 13:21 UTC at https://sih-2026-k5jr.onrender.com. The live connection panel reports the application server and PostgreSQL responding.

Live browser verification used a newly created private demonstration, without writing operational records:

- Acknowledged the simulated generator warning, assigned a dated work order and created a linked fictional crew assignment.
- Demonstrated boundary uncertainty and a configured zone breach. Saved an inspection note and an early check-in; both appear in the contact log and incident replay.
- Started and resolved the work with specific notes. The sensor correctly remained unrecovered.
- Generated and saved a handover. Its preserved report and private-demo editing access survived a full page reload.
- Saved a named fuel comparison after reload. Its evidence panel shows the input inventory, burn observation, shipment, formula and time mismatch assumption.
- Verified browser Back/Forward between workspaces and Escape dismissal of the calculation dialog. Inspected desktop views in both themes; no document-wide horizontal overflow at the tested 1348 px width.
- The visual review found small map labels and faint definition-list values in light mode. Labels were enlarged and light-theme facts now use theme text colours. The old fixed maintenance due date was removed; users explicitly choose a deadline.
- The Render error-log query from deployment start through 13:30 UTC returned no error entries.

Remaining verification: mobile-device and screen-reader review; comprehensive keyboard and contrast audit; the skipped disposable PostgreSQL concurrency test; and independent production backup/restore and durable source-file checks. A responding database and a successful browser reload do not establish all of those properties. The automated restart/restore test uses a disposable local SQLite database, not the production PostgreSQL database.

The release uses the existing Render service and database. No new paid resources, storage configuration, credentials or account permissions were created or changed. Real trackers, station-surveyed geometry, offline queued writes and live Antarctic sensor ingestion remain outside this release.
