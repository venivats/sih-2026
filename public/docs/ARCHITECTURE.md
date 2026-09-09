# Architecture and decisions

POLARIS is a modular monolith: React 19 / TypeScript / Vite 7; Tailwind 4 design tokens; TanStack Query 5; Recharts 3; FastAPI; SQLAlchemy 2; Alembic; PostgreSQL 17 in the container configuration. Both JavaScript and Python dependency versions are locked.

| Layer | Responsibilities | Source |
|---|---|---|
| React console | Navigation, accessible native controls/dialogs, schematic, charts and deliberate failure states | src/ |
| API adapter | Backend calls and explicitly separate browser-only demo adapter | src/api.ts |
| Access | Argon2 password hashing, OAuth2 bearer JWT, role and workspace checks | backend/modules/access.py |
| Assets | Database-backed graph and impact traversal | backend/modules/assets.py |
| Telemetry | Unit/time validation, persistence, debounce/hysteresis evaluation | backend/modules/telemetry.py |
| Maintenance | Acknowledge, assign, transition, independent recovery | backend/modules/maintenance.py |
| Logistics | Serialized ledger writes, idempotency, nonnegative stock | backend/modules/logistics.py |
| Ingestion | Atomic CSV import, preserved originals, NASA connector | backend/modules/ingestion.py, provider.py, storage.py |
| Energy/scenarios | Explainable resource formulas and pure what-if calculations | backend/modules/energy.py, scenarios.py |
| Persistence | ORM tables, constraints, frozen initial migration | backend/models.py, migrations/ |

## ADR-001: preserve the requested backend
Available Sites hosting supports the frontend, not FastAPI containers or managed PostgreSQL. The public deployment is therefore an explicitly labelled browser demonstration. A separate Docker image runs React and FastAPI from one origin and connects to PostgreSQL. It is prepared for a conventional container host; no hidden substitution of D1 for PostgreSQL is made.

## ADR-002: keep data honesty structural
Every row belongs to a workspace. Scoped query helpers and endpoint authorization enforce workspace separation. References are resolved within both workspace and station. Operational initialization creates an empty workspace; seed functions explicitly refuse operational simulation seeding. Public shared demo is read-only; public interactive sessions get isolated workspaces and expiring JWTs. The browser-only adapter has no server credentials or shared writes.

## ADR-003: one inventory ledger
Fuel autonomy reads the same inventory item used by logistics. A short workspace-row write lock orders transactions, including idempotency checks. PostgreSQL row locks and unique keys prevent races; SQLite fallback uses its writer lock for development tests. Concurrent operations on different workspaces can remain independent in PostgreSQL. Negative stock is rejected in service logic and by a database constraint. This simple scheme favours correctness over maximum throughput.

## ADR-004: lightweight streaming
The backend sends SSE refresh notifications. Fetch streaming permits Authorization headers; the client reconnects with backoff and polls every 20 seconds as fallback. These events invalidate queries rather than representing a durable event stream. Cached data is labelled; offline writes are disabled. No durable offline synchronization is claimed.

## ADR-005: authentication scope
Uses FastAPI's documented OAuth2 password/bearer approach, Argon2 through pwdlib and signed expiring JWTs through PyJWT. Operators cannot import or edit rules. Users are reloaded on authenticated requests, so changed roles take effect. Demo tokens are restricted to their own workspace. Tokens remain in browser memory, not persistent local storage. Refresh/login recovery, SSO and MFA are future integrations, not claimed features. The single-process rate limiter must be moved to a gateway when scaling beyond one process.

## ADR-006: deployable storage
Local Docker uses a named file volume; production can use a mounted durable disk or private S3-compatible bucket. Originals use content-addressed keys within workspace namespaces and SHA-256 manifests. This guarantees byte traceability, not scientific verification. PostgreSQL and file storage need coordinated backups.

## ADR-007: investigation as a view over existing records
The overview now prioritizes the asset dependency graph and incident queue. The investigation dialog composes the existing maintenance workbench with the triggering measurement, rule, provenance, history and registered backup paths. It uses the same mutation adapter and authorization rules, avoiding a second maintenance implementation. The graph's presentation groups database assets by subsystem; screen positions do not represent surveyed geography. Selected paths indicate potential dependency exposure, not confirmed outages.

Charts offer historical windows ending at the latest observation, threshold lines, trigger markers and accessible record tables. Missing samples are not imputed; expected sampling cadence remains unverified. Motion is limited to brief interaction feedback and respects reduced-motion preferences. No new runtime dependency, schema migration, station metadata or synthetic source attribution was introduced by this redesign.

## ADR-008: briefing and coverage are derived views
Console 03 introduces an operations briefing, evidence coverage matrix and a fuel planning horizon. These are pure client-side views over the selected workspace snapshot. The horizon changes no inventory or operational record and explicitly assumes constant historical burn. Coverage means at least one non-null latest metric per registered asset, not verified equipment health. The export preview retains classification, observation time and source identifiers. A contrasting ice-coloured schematic improves separation from the charcoal analytical workspace without introducing a fabricated station map or decorative 3D model.

## Official documentation consulted
- https://vite.dev/guide/ — Node compatibility and build setup.
- https://fastapi.tiangolo.com/deployment/docker/ — build a project-owned container.
- https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ — password hashing and bearer-token implementation.
- https://tanstack.com/query/latest/docs/framework/react/overview — query cache and invalidation.
- https://alembic.sqlalchemy.org/en/latest/tutorial.html — migration discipline.
- https://render.com/docs/deploy-fastapi — example container hosting pathway.
- https://render.com/docs/disks and https://render.com/docs/postgresql-creating-connecting — persistence requirements.

These choices are prototype engineering decisions, not NCPOR architecture or operating procedures.


## ADR 004 — Evidence-led console and private exercises (9 September 2026)
The same record-backed twin drives the overview and dedicated asset workspace. Equipment health is never inferred from a successful fetch; observation age and verification remain separate. The 65/35 drawing/inspector split collapses vertically on smaller screens. Animation emphasizes graph paths only, not measured current or fuel flow.

Private incident exercises call one backend transaction and reuse ingestion, locking, debounce and recovery. Idempotency is checked under the generator asset lock. Active incidents deduplicate; the exercise never fabricates recovery to force a new alert. The browser demonstration implements the same sequence on a private snapshot, committing it once. Tab mutations serialize to prevent lost updates. Browser persistence is explicitly not team storage.

## ADR 005 — Waste custody as an additive module
Migration 0003 adds scoped waste records, quantity/unit validation, source evidence, shipment links, custody history and an idempotency constraint. Each transition is authorized and audited. No material is seeded; demonstration entries are classified as simulation. The register supports review, not regulatory certification or proof of physical transfer.

## ADR 006 — Low-bandwidth honesty and scientific limits
A preference disables SSE and animation, reduces connected polling to 120 seconds, and disables refetch-on-focus. Failed refreshes retain labelled cached records and prevent writes. There is no durable offline write queue or binary-delta protocol. The assumed 180-day target and ±20% burn sensitivity are explicitly scenario inputs. Thermal holdover, actual satellite passes and ML confidence need validation inputs before implementation.

Documentation consulted: [FastAPI dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/), [TanStack Query documentation](https://tanstack.com/query/latest/docs/framework/react), and [Antarctic Treaty waste-management information](https://www.ats.aq/e/waste.html). Existing compatible dependency pins and lockfiles are retained.

## ADR-009: addressable console and scientific evidence separation
The Expedition release uses the browser History API with typed station/page/detail routes. React remains a Vite application and hosting rewrites route refreshes to index.html. URL mode selects a workspace class; private workspace identifiers stay in session storage and backend permissions still resolve every request. Native form controls provide dark/light/system preferences without a new component dependency.

Migration 0004 adds a station/workspace-scoped operations register. Typed Pydantic data variants validate crew, outdoor task, contact, research and immutable handover data. Idempotency keys, version checks, row locks and audit history protect consequential writes. The browser demo mirrors these behaviours in serialized tab-local mutations, with its storage limit labelled.

Pure scientific functions calculate weather review, resupply coverage, one backup path ceiling, thermal sensitivity and read-only quality findings. New model tests cover missing/stale data and isolation. Handover exports copy the input records so later edits cannot rewrite the captured baseline. Station answers use supported deterministic intents and actual identifiers; no external model receives station data.

Documentation consulted for routing/theme behaviour: https://developer.mozilla.org/en-US/docs/Web/API/History_API and https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme . Existing dependency pins and both lockfiles are retained. The full assumptions and changes are in EXPEDITION_RELEASE.md.
