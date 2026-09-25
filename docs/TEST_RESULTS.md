# Current verification — 13 September 2026

- Backend suite: **30 passed, 1 skipped**, 44.53 seconds; one upstream Starlette deprecation warning. Temporary SQLite; PostgreSQL contention remains skipped.
- Model suite: **8 passed**. Recorded median/MAD guards, source separation, unit/coverage/rate guards, existing operations and engineering models. No real-world anomaly performance claimed.
- Browser: dark station overview and light recorded-signal analysis inspected. Private demo stays editable on reload; fictional crew saves. NCPOR strip matches original parsed reports stamped 12 September with unzoned times. Compact toolbar, navigation and analysis checked in 390/768 px frames with 375/753 px content widths and no document overflow. Real mobile browser/touch and screen reader audit remain unverified.
- Two separately authenticated accounts share saved operations and scoped update revisions. Stale version writes return 409; a server-side role reduction is effective for an existing token. Reconnect checks latest revision. This is a local backend test, not a hosted two-browser test.
- TypeScript/Vite production build passed. Same-origin Vercel build and final static publication build are executed separately; no deployed Vercel route or persistence result is claimed.
- Direct NCPOR download succeeded on 13 September. Preserved bytes parse Maitri/Bharati temperatures and unzoned provider labels; original/calibration semantics remain unverified. No operational Measurement was created.
- No managed database/bucket, restore test, orbital prediction, durable offline-write synchronization or independent audit has been completed.

Earlier release history follows; dated failures below describe those earlier attempts.

---

# Actual verification results — 9 September 2026

## Executed for the Expedition release
- `.venv/bin/python -m pytest backend/tests -q`: **22 passed, 1 skipped**, 19.19 seconds. One upstream Starlette/AnyIO deprecation warning. Temporary SQLite databases only; no operational records changed.
- `node --test tests/models.test.mjs`: **5 passed**. Covers stock/ETA resource calculations, missing/stale/non-observation weather, storm isolation, frozen handover inputs, unsupported station questions, failed backup paths, thermal input domain, original-record preservation and repeatable synthetic benchmark accounting.
- Production TypeScript + Vite build: **passed**, 2,328 modules. Application bundle about 764 kB (231 kB gzip), CSS 73 kB. Dependency versions and lockfiles retained.
- Cloud browser at the internal preview: **passed the specific checks below**, using the browser client's Playwright locators and screenshot inspection. These were interactive checks, not a run of the full Playwright CLI suite.

## Browser checks performed
1. Dark overview and light operations/science pages rendered. Fixed navigation clipping, light form-label contrast, checkbox layout and table colours discovered during inspection.
2. Station pages have distinct URLs. Back and Forward returned between Operations and Scientific workspace with the selected subsection retained.
3. GEN-A asset detail has a direct address; reloading reopened its inspector. Closing it returned to Digital twin.
4. A private fictional crew record saved with a duty period. An outdoor task linked that crew member and the demonstration shipment.
5. A 130 km/h assumed wind changed task review to threshold exceeded without updating task status or shipment ETA. Model tests separately verify baseline records stay untouched and unavailable inputs remain unavailable.
6. A reviewed handover saved, survived reload and remained accessible in the Handover subsection. Record-backed fuel answer displayed 28,400 L / 36.4 days and evidence links.
7. Capacity inspection showed a 180 kW illustrative backup ceiling. Selecting failed electrical distribution returned 0 kW and no surviving registered path. Thermal sensitivity displayed its assumptions and equation.
8. Geographic map located Maitri/Bharati and showed a dated, credited Maitri photograph. The header image was labelled coastal West Antarctica, not a station survey.
9. Switching from private asset detail to Operational displayed absent topology and backend-unavailable state, with no seeded assets.

## Backend acceptance coverage
The 22 passing tests include the complete maintenance/spare workflow; public protected-mutation denial; station/workspace separation; independent visitors; inventory duplicate/negative/concurrent issues on SQLite; atomic import, preserved originals and nulls; hysteresis/recovery/late-data behaviour; pure scenarios; shared fuel source; repeatable seeding; additive migration through 0004 preserving saved records; backup/restore without overwrite; private exercise idempotency; waste custody; operations field/date validation, scoped links, optimistic versions, duty assignment and immutable handovers.

Passing these tests does not establish dataset authenticity or Antarctic operational safety.

## Authored, not fully executed here
The Playwright CLI specifications now include route/theme/detail reload and crew/task/handover regression flows, alongside prior maintenance/import-related browser checks. Existing navigation locators were updated for actual links. The full Desktop Chrome / Pixel 7 matrix was not executed in this cloud browser environment; run `npm run test:e2e` with installed Playwright browsers and the documented preview URL.

## Remaining verification
- PostgreSQL contention test skipped: no disposable `TEST_POSTGRES_URL`. SQLite concurrency success is not claimed as a PostgreSQL result.
- No managed PostgreSQL backup/restore, production backend authentication/uploads or persistence after hosted-container restart has been verified.
- Mobile emulation and network-outage browser simulation are not verified in this release. Responsive CSS and existing disconnected-write guards remain in place.
- No deployed Vercel URL is verified. Sites publication status is reported by the native hosting service after this source is published; agent-side checks used the internal preview.

## Official weather intake addition (9 September 2026)
25 backend tests passed; 1 PostgreSQL test skipped. Production TypeScript/Vite build passed. New tests verify admin permissions, download byte preservation and checksum, two-station parsing, cooldown, failure history and no measured telemetry writes. Parser fixtures are fabricated; raw government download and live-feed integration have NOT succeeded. No new deployed-backend persistence or browser result is claimed.
