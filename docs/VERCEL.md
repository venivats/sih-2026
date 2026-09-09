# Vercel browser demonstration

This deployment publishes the React demonstration only. It does not provision FastAPI, PostgreSQL, durable uploads or team authentication. Operational readings remain unavailable. Private demonstration changes are stored per browser tab.

1. Open https://vercel.com/new and sign in with GitHub.
2. Select your personal Hobby scope. The Hobby plan is free for personal, non-commercial projects within its limits; do not select Pro, a trial or paid integrations for this deployment.
3. Import `venivats/sih-2026`. If it is missing, configure the Vercel GitHub integration to allow that private repository.
4. Use project name `polaris-antarctic-ops` (or another available name) and root directory `./`.
5. Framework: Vite. Install command: `npm ci`. Build command: `npm run build`. Output directory: `dist`. These settings are recorded in vercel.json. Use Node.js 22.x in project settings.
6. Leave environment variables empty for the browser demonstration. In particular, do not set VITE_API_BASE_URL or upload .env. No backend credentials are needed for this deployment.
7. Click Deploy. Open the resulting production HTTPS URL and verify the Demo label, asset inspector, private exercise and unavailable Operational workspace.

Subsequent pushes to main normally trigger deployments once Git integration is connected. To deploy the complete persistent backend, follow DEPLOYMENT.md; this static configuration is not a substitute for that setup.

Current status: configuration prepared, not deployed on Vercel. The connected tool returned no teams. Automatic approval review rejected its unspecified deployment action because cost and scope were not established. No paid Vercel resources were authorized or provisioned.

Production TypeScript/Vite build passed on 9 September 2026 (2,319 modules, 4.43 seconds). This verifies the local frontend build, not a Vercel deployment.

Official references (Hobby documentation retrieved on 9 September 2026; Vite page retrieval timed out):
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/plans/hobby
