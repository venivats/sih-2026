# Deployment handover

## What is published through Sites
The React frontend uses an explicitly isolated browser demonstration, frozen simulated station records, a genuine historical NASA grid sample and per-tab what-if comparisons. It makes no hosted-backend, team-persistence, sign-in or durable-upload claim. Operational values stay unavailable there. Source code includes the independent FastAPI/PostgreSQL stack.

## Prepared full-stack deployment
A multi-stage Dockerfile builds the frontend with same-origin `/api`, then runs FastAPI as a non-root user. Alembic upgrades run before idempotent initialization. PostgreSQL must be persistent; original source files need a durable disk or private S3-compatible bucket.

The straightforward prepared route is a Docker web service plus managed PostgreSQL and a persistent disk on Render. **This route can incur charges. No paid service has been provisioned, and no cost approval is assumed.** A free ephemeral web service or expiring free database does not meet the requested durability requirement.

### Exact external next steps
1. Sign in to a container-hosting account. For the Render route, use https://dashboard.render.com/ . Review and approve its current web-service, database and disk prices before creating paid resources.
2. Put the saved source in a GitHub repository you own and connect that repository to the host. If using the source archive, extract it, open it in your IDE and publish it to a new repository; never upload `.env` or `polaris.db`.
3. Create managed PostgreSQL. Use the internal connection URL for a colocated backend, or require TLS for external access. Keep credentials in host secrets.
4. Create a Docker Web Service from the repository, using `Dockerfile`. No custom build/start override is needed. Health check: `/api/health`. Port: the host-provided PORT or 8000.
5. Set JWT_SECRET to at least 32 random characters; set unique ADMIN_USERNAME and ADMIN_PASSWORD (12+ characters). Set DATABASE_URL, replacing the `postgresql://` prefix with `postgresql+psycopg://`. Set CORS_ORIGINS to the actual HTTPS app origin, with no wildcard.
6. Mount a persistent disk at `/app/storage` and set STORAGE_PATH=/app/storage. Alternatively configure S3_BUCKET, S3_ENDPOINT_URL if needed, and restricted AWS credentials for a private bucket. Use provider-side versioning and lifecycle settings according to your retention policy.
7. Deploy only after the PostgreSQL integration and restore tests pass in that environment. Check `/api/health` reports `postgresql`, not `sqlite`.
8. Verify the issued HTTPS URL, public read-only access, administrator login, isolated sessions and CSV import. Record a work order, redeploy/restart, and confirm the same record and source checksum remain. Exercise a restore to a fresh database/bucket before claiming recoverability.

If a host account becomes connected to this environment, deployment can proceed with the prepared source after any necessary cost approval. Sites itself does not provide the requested Python container/PostgreSQL hosting.

## Runtime variables
See `.env.example`. VITE_API_BASE_URL is build-time only; changing it requires rebuilding the frontend. The Dockerfile sets it to `/api`, so the frontend and backend share one HTTPS origin. No user-owned domain is required; a host-issued HTTPS domain is sufficient.

## Security scope
OAuth2 bearer tokens are in memory with two-hour expiry; Argon2 password hashes and roles are stored in the database. The backend checks every workspace and protected mutation. Public shared demo cannot be mutated. Rate limits cover login and demo-session creation in one process. Do not increase worker count without shared gateway rate limits. No real equipment-control endpoints exist.

Before an operational pilot: configure TLS, backups, alert-rule approval, real station asset/topology validation, retention/cleanup for abandoned demo sessions, stronger account recovery/SSO/MFA, file scanning and monitoring. Those are actual prototype limits, not claims of completed integrations.
