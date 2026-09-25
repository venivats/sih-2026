# Windows setup for beginners

## Recommended: Docker Desktop
Install Git for Windows, Docker Desktop with WSL 2 enabled, and Python 3.12. Open Docker Desktop and wait until its engine is running. Obtain the POLARIS source folder from this project's saved source. Open PowerShell in that folder. Do not place it inside your previous prototype.

```powershell
python scripts/setup.py
docker compose up --build
```

The first command creates a unique `.env` without overwriting existing settings. The second builds React and starts FastAPI plus persistent PostgreSQL. Open **http://localhost:8000**. Keep the terminal open. Press Ctrl+C to stop; restart with `docker compose up`. To run in the background, use `docker compose up -d`.

To sign in, open `.env` in your local editor and use `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Never paste that file into chat, publish it, or commit it. Change the generated administrator credentials through your deployment secret settings before sharing a hosted backend.

`localhost` is your own computer; it is available only while the services are running. It is not a public deployment.

```powershell
docker compose ps
docker compose logs --tail 50 app
```

Use these commands if the page does not load. PostgreSQL starts first; the application waits for its health check. Check port 8000 is not occupied by another app. Do not use `docker compose down -v`: that removes the saved database and file volumes.

## Development without Docker (SQLite fallback)
Install Node.js 22.12+ and Python 3.12. SQLite is for local learning and the included smoke tests; PostgreSQL is the intended production database.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
npm ci
.\.venv\Scripts\python.exe scripts/setup.py
.\.venv\Scripts\python.exe scripts/local.py -m alembic upgrade head
.\.venv\Scripts\python.exe scripts/local.py -m backend.seed
npm run dev
```

Open **http://localhost:4173**. The launcher starts both processes and forwards Vite flags. The default SQLite database is `polaris.db`; originals are in `storage/`. Both survive application restarts. Keep the terminal open. This path requires no PowerShell execution-policy changes or virtualenv activation.

For PostgreSQL development, set `DATABASE_URL` in `.env` to `postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE`, then run migrations against that database before starting. Do not point test commands at saved application databases.

## Run the checks

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm run build
npx playwright install chromium
npm run test:e2e
```

Start the development server before browser tests. The included Playwright tests default to an explicitly selected browser demo; backend tests use disposable SQLite databases. To exercise PostgreSQL contention, provide a **disposable** `TEST_POSTGRES_URL` in the test process. See TEST_RESULTS.md for what was actually executed in this build.

## Git checkpoints

```powershell
git status
git add src backend docs migrations scripts
git commit -m "Describe one tested change"
```

Commit package-lock.json whenever JavaScript dependencies change. Commit requirements.lock whenever Python dependencies change. Review changes before pushing. Keep `.env`, databases, uploads and temporary test output out of Git. Make a new additive Alembic revision for schema changes; never edit a released initial migration to alter an existing database.
