# POLARIS on Vercel — connected application

Independent SIH26060 prototype; not government-endorsed or operationally validated.

## Prepared configuration

The existing Vite project now includes `api/index.py`, a supported Python ASGI function importing the same FastAPI modular monolith used by Docker. `vercel.json` routes `/api/*` to that function and station routes to React. The Vercel build script sets `VITE_API_BASE_URL=/api`. The normal Sites build remains a static publication with explicitly isolated browser demo state.

The function fails closed with HTTP 503 if Vercel lacks PostgreSQL, a sufficient JWT secret or a private S3 bucket. It never seeds, migrates or writes to a local database on request. Source uploads cannot fall back to Vercel's temporary filesystem. SQLAlchemy uses NullPool on Vercel; use a managed provider's pooled PostgreSQL URL. Auth tokens remain in memory: after a full page reload, sign in again to reopen shared records. The public session creation/login limiter is process-local; configure shared gateway rate limits before scaling across instances. SSE streams are finite (about 22 seconds), inspect committed scoped audit revisions and reconnect; polling remains available.

No Vercel deployment or managed database has been activated or platform-tested. The connected account returned no accessible teams on 13 September 2026. Docker remains available for a conventional deployment. The /api function pattern is supported for existing projects; we retain it to avoid restructuring into beta Services.

## Beginner activation steps

1. Sign in to https://vercel.com/new with GitHub and import `venivats/sih-2026`. Choose your intended account scope. Stop before purchasing a plan or paid integration; the account owner must approve displayed charges.
2. Root directory: repository root. Framework: **Vite**. Node: **22.x**. Install command: `npm ci`. Build command: `node scripts/build-vercel.mjs`. Output: `dist`. Keep the committed routing configuration.
3. Obtain a managed PostgreSQL database and private S3-compatible bucket from your chosen providers. Review their retention, backup, access and pricing terms. This is separate from publishing the frontend.
4. In Vercel → Project → Settings → Environment Variables, set server-only `DATABASE_URL` (pooled PostgreSQL with TLS), `JWT_SECRET` (random, 32+ characters), `S3_BUCKET`, provider `S3_ENDPOINT_URL` if needed, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `APP_ENV=production`, and `ENABLE_PUBLIC_DEMO_SESSIONS=true`. Scope secrets to the intended Production environment. Use a separate disposable database/bucket for Preview. Never prefix secrets with `VITE_`, commit them, or paste them into chat.
5. Before the first deployment, initialize the intended database explicitly. On a trusted machine with this repository and its Python environment, load those server variables plus a chosen `ADMIN_USERNAME` and a unique 12+ character `ADMIN_PASSWORD`, then run `python -m scripts.activate_backend`. This applies additive Alembic migrations and repeatable initialization. Existing saved records are retained. Do not point this command at an unrelated database. Admin credentials are needed only for initial account creation, not as permanent Vercel environment variables.
6. Deploy. Open `/api/health`: verify PostgreSQL responds. Open the HTTPS application and use Connection, then sign in. Test anonymous mutation rejection and empty operational measurements. The initial database contains illustrative assets in demo only. Register operational assets and source-backed measurements deliberately.
7. Use an administrator to request NCPOR page intake. A successful report remains `review_required` until measurement semantics/timezone/reuse terms are resolved. The bundled archived report does not populate the operational database automatically.
8. Save a test record and upload an original. Redeploy and verify both survive. Complete a separate-database restore exercise and PostgreSQL concurrency checks. Verify API rewrites, streaming reconnect and permissions on Vercel itself before calling hosting verified.

## Team roles

Create accounts from a trusted terminal using `python -m scripts.create_user USERNAME --role ROLE`; it prompts privately for a password. Supported project-defined roles: viewer, scientist (research), maintenance_engineer (maintenance), logistics_coordinator (logistics and operations registers), station_lead (all those operational areas), operator (also telemetry), administrator (also settings/imports). All five write-capable operational roles can save handovers. These are prototype permissions, not verified NCPOR staffing policy. Do not store medical records in the general crew register.

## Release and rollback

Before each update, back up the managed database and bucket; apply migrations explicitly, then deploy compatible code. Do not run migrations on every function invocation or automatically against Production from preview builds. Roll back code only when compatible with the current schema; otherwise restore into a separate database and inspect before switching. Keep an exact release reference and deployment result. See BACKUP_RESTORE.md for the remaining managed restore gate.

Official documentation rechecked 13 September 2026:
- https://vercel.com/docs/functions/runtimes/python/api-directory
- https://vercel.com/docs/functions/runtimes/python
- https://vercel.com/docs/frameworks/backend/fastapi
