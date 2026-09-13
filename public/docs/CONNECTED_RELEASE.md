# POLARIS connected-release handover — 13 September 2026

The application now has a prepared Vercel API target, project-defined write permissions, revision-based shared updates, recorded-signal analysis and a newer official weather archive. The public Sites URL still serves the isolated browser prototype. No Vercel project, managed PostgreSQL database or durable bucket has been activated.

## What to open

1. **Station overview:** compare the separately labelled NCPOR published reports. The original page downloaded on 13 September reports Maitri −21.1 °C and Bharati −20.5 °C, both stamped **12 September 2026, 11:00 PM** without a timezone. The download timestamp is different from the provider timestamp. These values do not enter operational calculations.
2. **Scientific workspace → Recorded trends:** select a source-specific signal, preceding-sample window and review threshold. The current sample is excluded from the median/MAD baseline. The panel explains the modified z-score, displays source records and provides an accessible table. Invalid timestamps, duplicate times, large gaps, zero MAD or fewer than 12 usable preceding samples leave scoring unavailable.
3. **Energy & resources:** inspect the fuel outlook based on up to 30 days of recorded burn rates. It needs at least seven distinct UTC days and 80% coverage over the observed span. Current demo history is too short, so no outlook is fabricated. The historical-rate sensitivity range is explicitly **not a prediction interval** or a validated forecast.
4. **People & operations:** use a private demo for fictional crew and handovers. Reloading preserves tab-local records and editing permissions. On small screens, use **More tools** for theme, connection, perspective and exercise controls.
5. **Connection:** inspect backend readiness and the official source. Follow VERCEL.md for the connected deployment. A refresh request on an activated server stores the official page and records failures; it does not silently replace measured telemetry.

## Project-defined permissions

All roles can read operational records after authentication. The backend enforces writes; UI visibility alone never grants access. These are our prototype roles, not an official NCPOR staffing policy. Medical data is outside this register.

| Role | Write areas |
| --- | --- |
| Viewer | None |
| Scientist | Research, handovers |
| Maintenance engineer | Acknowledgements, work orders, spare allocations, attachments, handovers |
| Logistics coordinator | Inventory, shipments, waste, crew/outdoor/contact registers, handovers |
| Station lead | Maintenance, logistics, operations, research, handovers |
| Operator | Station-lead areas plus telemetry |
| Administrator | All areas plus settings, assets, rules and imports |

Shared demo records stay read-only. Visitor sessions remain isolated from each other and operational records. Auth tokens are kept in memory; a full reload requires signing in again on the connected application. Browser-demo records are tab-local, not shared operator records.

## Verification

- 30 backend tests passed; one PostgreSQL contention test skipped because no disposable PostgreSQL server is available.
- Eight deterministic model tests passed, including gap/duplicate handling, source separation, fuel units, nonpositive burn, sparse coverage and unchanged original inputs.
- The distinct-account test signs in two different station-lead users, checks persisted visibility, actor identity, update-stream revisions/reconnect, stale-edit rejection and effective permission reduction for an already-issued token. It uses temporary SQLite, not deployed Vercel.
- Browser checks: dark overview, light recorded analysis, restored private-demo editing, fictional crew save, source labels, compact toolbar, narrow navigation and recorded-analysis layout. The responsive fixture uses 390/768 CSS-pixel frames (375/753 content widths after scrollbars) with no document overflow. This is not iOS/Android hardware testing or a full accessibility audit.
- Production builds are recorded in TEST_RESULTS.md. Platform routing, cold starts and managed persistence remain deployment checks.

## Remaining activation and evidence requirements

1. Make the intended Vercel project/team accessible, then configure the prepared PostgreSQL, signing secret and private object-storage variables. Review provider charges before provisioning. Vercel access currently exposes no team.
2. Run explicit migrations/initialization, deploy, and verify API routing, two-account updates, uploads through redeployment and restore into a separate database. Configure a shared gateway rate limit before scaling; the local request limiter is process-local.
3. Resolve weather timestamp semantics, provider cadence and instrumentation before admitting readings into operational calculations. A page download is not proof of a live sensor connection.
4. Real station equipment/topology, calibrated thermal parameters, labelled anomaly history and reconciled fuel history are still needed for validated engineering predictions. The current statistical benchmark is wholly synthetic.
5. Orbital visibility calculations, durable offline write synchronization and independent security/accessibility review remain pending. Operator-entered contact windows, read-only cached views and isolated exercises are available; they do not imply those later capabilities are complete.

## Sources

- NCPOR published weather: https://data.ncpor.res.in/ — originals and acquisition manifests are retained under `data/acquisitions/ncpor/`.
- NIST modified z-score reference: https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm — our preceding-window adaptation is an explicitly stated heuristic.
- Vercel Python /api support: https://vercel.com/docs/functions/runtimes/python/api-directory — `/api/index.py` maps to `/api`; same-origin API rewrites target that function.

Keep these distinctions in the presentation: published report versus live observation; calculated sensitivity versus validated forecast; prepared integration versus activated shared service.
