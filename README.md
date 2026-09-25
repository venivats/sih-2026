# POLARIS — Antarctic Operations
An independent SIH26060 engineering prototype for the remote management of Maitri and Bharati research stations.

Start with [the handover](docs/HANDOVER.md). For a local PostgreSQL deployment, install Docker Desktop and Python, then run:

```powershell
python scripts/setup.py
docker compose up --build
```

Open http://localhost:8000. Keep the services running. Generated local credentials are in `.env`; never share or commit it.

For development, see [Windows setup](docs/WINDOWS_SETUP.md). The public Sites build is a separately labelled browser-only demonstration; the Docker image runs the connected React/FastAPI/PostgreSQL stack.

Tests: `python -m pytest backend/tests -q` in the project virtualenv. Frontend: `npm run build`. Standalone browser tests are supplied under `tests/browser/`; actual verification results and untested gates are recorded in [TEST_RESULTS.md](docs/TEST_RESULTS.md).

All simulated station measurements identify POLARIS as their source. The genuine NASA POWER sample retains its original response, checksum and historical reanalysis classification. No government endorsement, operational validation or station-control capability is claimed.
