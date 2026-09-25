# Vercel frontend with connected Render API

This deployment uses Vercel for the Vite frontend and an external rewrite from `/api/:path*` to the existing `sih-2026-k5jr.onrender.com` FastAPI service. The Render backend retains its existing PostgreSQL database, authentication, migrations and upload configuration. This is a hybrid deployment, not a migration of the backend to Vercel.

The Vercel build uses `node scripts/build-vercel.mjs` and publishes `dist`. `.vercelignore` prevents Vercel from bundling the unused Python function and parsing its pinned requirements for this frontend target. The Python backend files remain in the repository and remain available to the Render Docker build. Do not configure Vercel-only environment credentials or local SQLite storage for this frontend project.

To verify a new deployment, open an addressable station route, check Connection for both application and PostgreSQL availability, start an isolated private demonstration, acknowledge a warning, save a record and reload the page. Test `/api/health` on the Vercel origin; it must return the backend's JSON, not the Vite HTML fallback. Verify response-option saves and record downloads separately, including any size or timeout limits imposed by proxying. Do not claim backend independence from Render: if the Render service sleeps or fails, Vercel will still load the shell but connected operations may be unavailable.

The crew map, sensor readings and scenarios in the guided exercise remain simulated. Official weather reports remain archived source material and are not station telemetry. Offline queued writes, actual tracker connectivity and production disaster response remain outside this deployment.
