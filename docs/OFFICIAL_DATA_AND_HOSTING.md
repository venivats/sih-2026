# Official weather and backend activation

Independent SIH26060 prototype. Not government-endorsed or operationally validated.

## What is connected today?

The public Sites publication serves a frontend and an isolated browser demonstration. It does not host FastAPI, PostgreSQL, station sensors or a background weather collector. The Connection button reports this explicitly. No measured operational temperatures are seeded.

The repository now includes protected official-weather intake endpoints and an additive migration (0005). Intake downloads the official page, preserves original bytes and checksum, and records separate reports for Maitri and Bharati. It never creates operational measurements automatically. Failed attempts remain visible alongside the last retrieved report. Only an administrator may request retrieval; attempts have a one-hour cooldown, 20-second timeout and 2 MB limit. Parser version: see each stored report.

## Source register: researched 9 September 2026

| Candidate | Coverage and access evidence | Retrieval / terms status |
| --- | --- | --- |
| NCPOR, Weather at Indian Polar Stations — https://data.ncpor.res.in/ | Public page lists Maitri and Bharati temperatures in degrees Celsius with a displayed date/time. Web reader saw 8 September 2026, 11:00 PM. Timezone and update cadence were not stated. | Web reader succeeded; direct backend-environment download returned HTTP 502. No successful original response was acquired. Dataset-specific automated reuse permission is unresolved. |
| NCPOR weather graphs — https://data.ncpor.res.in/graph | Lists Maitri surface/AWS datasets and Bharati DCWIS/AWS datasets; temperature, pressure, wind and humidity options. | Catalog inspected only. No underlying dataset/API downloaded or endpoint guessed. |
| NPDC Data Policy & Guidelines — https://npdc.ncpor.res.in/npdc/mainmenu_home.action?main_menu_id=55&main_menu_name=Data+Policy+%26amp%3B+Guidelines&ref_id=REF14329 | General policy describes metadata access and data policies. | General policy access does not establish dataset-specific acquisition, licence or measurement authenticity. |

The parser has passed fabricated fixture tests, but is not validated against a successfully downloaded original provider page. A changed page or absent station/date causes an explicit failure. A provider timestamp without a timezone stays unzoned: it is not silently treated as UTC. Reports remain `review_required`, not live telemetry. A checksum establishes byte integrity only.

Before promoting a feed into operational calculations, confirm provider measurement semantics, timezone, source instrumentation, update cadence, permitted reuse and quality flags; validate the parser against an original download. Preserve lineage and keep unavailable measurements null. The source's availability and our backend's health are independent.

## Exact hosting next steps

Use the repository's Dockerfile to serve React and FastAPI together over one HTTPS origin. This avoids cross-origin authentication configuration and connects the frontend to `/api` automatically.

1. Sign in at https://dashboard.render.com/ and connect GitHub repository `venivats/sih-2026`. No password or access token should be pasted into chat.
2. Review the cost of one Docker web service, persistent PostgreSQL and durable source-file storage. **Stop before creating paid resources until the account owner approves the displayed charges.** Free web filesystems are ephemeral and cannot use persistent disks; Render free PostgreSQL expires after 30 days and does not provide backups. It does not meet this project's durable deployment requirement.
3. After budget approval, create PostgreSQL and a Docker Web Service from the repository's `main` branch, root directory blank, Dockerfile `./Dockerfile`. Keep both services in the same region. Use health-check path `/api/health`.
4. Configure server environment: `APP_ENV=production`, `DATABASE_URL` from the database's internal connection string, a generated `JWT_SECRET` of at least 32 characters, `ADMIN_USERNAME` of your choice, and a unique `ADMIN_PASSWORD` of at least 12 characters. Generate credentials in the hosting secret interface or a password manager. Do not commit them.
5. Attach a persistent disk at `/app/storage` and set `STORAGE_PATH=/app/storage`; alternatively configure the documented private S3 bucket variables. Confirm the application's UID 10001 can write to the mount. Do not use the disposable container filesystem for uploads.
6. Set `CORS_ORIGINS` to the final HTTPS service origin (no trailing slash) and `ENABLE_PUBLIC_DEMO_SESSIONS=true`. The container builds `VITE_API_BASE_URL=/api`, runs Alembic migrations and repeatable initialization, then starts the API. Do not replace existing saved database records.
7. Open the HTTPS address, use Connection to verify server and PostgreSQL response, sign in and open Operational. Measurements should be unavailable until genuinely acquired/imported. Request official page retrieval as administrator. An HTTP failure is a failed acquisition, not a live feed.
8. Save an authorized test record and source upload; restart/redeploy and verify both survive. Test public mutation rejection, workspace isolation and restore into a separate database before describing deployment as verified. Follow the existing backup/restore guide. Do not expose the database or bucket publicly.

Official host documentation consulted: https://render.com/docs/blueprint-spec and https://render.com/docs/free. No hosting resources were purchased or provisioned in this release. The connected Vercel account returned no accessible teams; no Vercel backend deployment was verified.

## Verification for this addition

Backend suite: 25 passed, 1 PostgreSQL integration test skipped. New fixture tests cover permission rejection, atomic two-station parsing, original preservation, checksum, cooldown, failed retrieval history and absence of operational measurement writes. They do not establish dataset authenticity or successful government-source acquisition. Managed PostgreSQL contention, backup restore and deployed backend persistence still require a real test/deployment database.
