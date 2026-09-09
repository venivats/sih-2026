# Verification update — 9 September 2026

## Current release
- Backend suite: **18 passed, 1 PostgreSQL test skipped**, 25.06 seconds. One existing Starlette/AnyIO deprecation warning. Temporary databases only.
- New tests cover private overheat/recovery exercises, cross-visitor and operational denial, idempotent retries, active-alert deduplication, a fresh alert after recovery, waste unit validation, custody ordering, scoped shipment links and unchanged inventory.
- Existing regression checks include saved work surviving additive migration through **0003**, backup/restore with original files, atomic imports, concurrent SQLite inventory, missing data, authorization and scenario non-mutation.
- Browser: ran overheat exercise; verified 94 °C at 06 September 2026 00:02 UTC, explicitly historical. Acknowledged, assigned Demo engineer / 10 September, reserved and consumed a coolant filter, and resolved with notes. Sensor stayed unrecovered; stock fell from 3 to 2.
- Browser: a development reload retained the private acknowledgement; restarting the private demo resumed it. Registered a 12 kg simulated waste consignment with collection evidence and shipment link; collected state and next packed step appeared.
- Browser: search selected GEN-B and correctly showed no telemetry; low-bandwidth preference activated; presentation hid navigation and Escape restored it. Operational twin remained unavailable. At the available laptop viewport the page had no horizontal overflow.
- Browser: +45-day vessel delay used the registered ETA to create a 120-day horizon from the historical baseline. Model returned 207.3 kW demand, 36.4 days autonomy and −65,200 L reserve.
- Direct keyboard automation of SVG paths was unavailable; an equivalent native HTML relationship list was added for accessible evidence inspection. Mobile emulation remains unavailable.
- Production build passed (2,319 modules; about 711 kB JavaScript before compression). Final release build is repeated after documentation packaging.
- The standalone Playwright file now contains eight desktop/mobile specifications. Tests were exercised through the supported browser API, **not the standalone suite**. Mobile emulation and a browser connected to the full backend remain unverified.

Historical results below retain their original dates and scope.

# Actual verification results — updated 8 September 2026

## September 8 design update
### Console 03 follow-up
- Visually inspected the substantially revised overview in the browser: station identity, compact metrics, contrasting schematic and priority rail.
- Browser: fuel horizon at 0 days showed 28,400 L; at 90 days showed 41,800 L shortfall at the recorded 780 L/day. No inventory mutation is performed by the control.
- Browser: evidence matrix showed 5 of 10 assets with available latest values and 2 null historical records; missing-only filter returned 5 asset rows.
- Browser: keyboard Home selected the first overview tab. Export preview included source identifiers, origin/verification, historical timestamps and unchanged baseline fuel inventory.
- The browser's automated download-event check timed out. The generated report preview and native download link were inspected; downloaded-file verification remains open.
- Added a sixth Playwright specification for the new briefing, coverage and operational-empty-state workflow. Standalone suite/mobile emulation not run; no new backend test run is claimed for this frontend-only follow-up.

- Re-ran backend regression tests: **16 passed, 1 PostgreSQL test skipped, 1 Starlette/AnyIO deprecation warning** (10.25 s).
- Production TypeScript/Vite build passed: 2,311 modules, approximately 668 kB JavaScript before compression.
- Browser: selected the primary generator on the overview and confirmed five registered downstream dependencies; opened the unified incident investigation.
- Browser: verified two-sample debounce, the 90 degC trigger and 85 degC recovery lines, the 6-hour historical window and original simulated-reading provenance.
- Browser: public acknowledgement was disabled. In a private demo, acknowledged, assigned an engineer/due date, allocated one coolant filter, started work, consumed the allocation and resolved with notes. Stock changed from 3 to 2; sensor remained unrecovered. Reloading and reopening the private demo retained the resolution.
- Browser: no page horizontal overflow at the available 1,363 px viewport (document width 1,348 px).
- Browser: opened NASA's preserved historical reanalysis evidence and checksum directly from Environment. Selecting NASA for Bharati showed no readings; the Maitri sample was not substituted. Operational power remained unavailable with an explicit disconnected-backend message.
- Added a fifth standalone Playwright specification for investigation, chart windows, public read-only controls and nested evidence dialogs. Updated the existing heading assertion. The standalone suite and mobile emulation were **not run** in this environment.
- Dataset bytes, schema, backend authorization and operational records were not changed by the visual redesign. Earlier checks below retain their original scope and are not claimed as fresh mobile or production-backend verification.

## Backend
Command: `.venv/bin/python -m pytest backend/tests -q`.

**16 passed, 1 skipped.** Tests use disposable SQLite databases in pytest temporary directories. One Starlette/AnyIO deprecation warning occurred; no failing assertions.

Passed checks cover:
- Telemetry → alert acknowledgement → assigned work → resolution, with independent sensor recovery.
- Public protected mutations denied; operational queries exclude simulated demo records; absent measurements stay null.
- Separate visitors cannot read or mutate each other's session workspace.
- Concurrent stock issues serialize; negative stock and duplicate transaction payload conflicts are rejected.
- Idempotent spare allocation, protected reserved stock, partial consumption, release and blocked premature resolution.
- Original CSV bytes retained; row validation, timezone requirements, null values, atomic commit and duplicate import race rollback.
- Alert debounce, deduplication, hysteresis, explicit recovery and rejection of late readings as current rule state.
- Repeatable scenarios leave stored records unchanged; energy uses the logistics fuel inventory.
- Repeated initialization preserves edits. An existing work order survives the additive 0001 → 0002 migration and reconnection.
- SQLite backup/restore preserves records and original file bytes, verifies checksums and refuses to overwrite existing restore destinations.

**Skipped:** PostgreSQL contention test. No PostgreSQL server or Docker daemon is available in this execution environment. Run with a disposable `TEST_POSTGRES_URL=postgresql+psycopg://…` database. SQLite results do not prove PostgreSQL-specific behaviour, container startup or managed-service recovery.

## Browser verification actually performed
Used the supported browser's Playwright-style API against the internal application preview in explicit browser demonstration mode:
- Started a private demo; acknowledged the generator alert; assigned a work order; started work; used one coolant filter; resolved with notes.
- Confirmed stock fell from 3 to 2 and the sensor remained unrecovered after resolution.
- Reloaded the page, reopened the private demo and confirmed the resolution remained.
- Appended an explicitly simulated 82 °C reading; confirmed independent sensor recovery.
- Allocated a spare in another session, consumed it and confirmed `used`, zero allocation remaining and correct inventory balance.
- Inspected asset dependencies and maintenance history; closed the detail dialog with Escape.
- Opened the NASA POWER historical sample, moved replay to 6 January 2024 and confirmed historical/reanalysis labels.
- Ran generator-failure analysis and saved a comparison. A second tab inherited neither comparisons nor maintenance changes.
- Switched to Operational and confirmed unavailable power values and the explicit disconnected-backend message.
- Inspected the laptop console visually and checked no horizontal page overflow at the available browser viewport.

Fixed during browser checks: UUID generation on HTTP preview, multi-day chart date ticks and secondary-series missing-value counting.

The repository now includes six Playwright tests configured for desktop and mobile. **The standalone `npm run test:e2e` suite was not executed here.** The cloud browser does not expose mobile viewport emulation; mobile layout and a full backend-connected browser run remain validation gates. The preview could not reach the isolated Python service; backend HTTP workflows were tested with FastAPI TestClient instead.

## Build and genuine retrieval
- Production TypeScript/Vite build: passed using the Sites build helper; Vite 7.3.1, 2,308 modules transformed.
- NASA POWER connector: actual successful retrieval of 14 daily grid values near Maitri, 1–7 January 2024. Original response, acquisition metadata and parser transformations are preserved in `public/evidence/`.
- Original SHA-256: `9ee9c35a62ec755045e13547259ef6ba97fbeba3048c5c53850b3e6bc7a7bb8d`.
- Provider acquisition is separate evidence from software tests. Passing tests and matching checksums do not establish scientific authenticity or station-observation status.

## Deployment boundary
The public Sites publication serves the React browser demonstration. It has no persistent FastAPI/PostgreSQL backend. Production login, shared persistence after backend redeployment, managed PostgreSQL restore, durable S3/disk behaviour, load tests and operational integration remain unverified until a container-hosting account and any required cost approval are supplied. No equipment controls or government endorsement are claimed.
