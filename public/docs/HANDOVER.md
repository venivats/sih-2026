# POLARIS — Antarctic Operations
Independent SIH26060 prototype. No government endorsement. No actual station-control integration or operational validation.

## Start here
Open the shared demo and select **Start private demo**. Go to **Alerts & maintenance** to acknowledge the generator alert, create a work order, allocate a coolant filter, start work, use the allocated filter and resolve it with notes. Inspect the fuel ledger, run a what-if scenario and explore the genuine historical NASA POWER sample.

The public frontend runs isolated demonstrations in each browser tab. It does not have a hosted FastAPI/PostgreSQL backend. Browser changes survive a reload of the private workspace URL in that tab. Closing the tab may remove them. Do not treat browser demo state as durable team storage.

The source contains the full React/TypeScript frontend, FastAPI backend, SQLAlchemy models, Alembic migration, PostgreSQL Compose setup, CSV import, provenance, resource model, authentication and tests. A conventional container host with persistent PostgreSQL and durable file storage is needed for the persistent team deployment. No paid services were provisioned.

## Guides
- [Windows setup and start](WINDOWS_SETUP.md)
- [Architecture and decisions](ARCHITECTURE.md)
- [Data-source register](DATA_SOURCES.md)
- [Administrator import guide](IMPORT_GUIDE.md)
- [Demonstration assumptions and equations](DEMO_MODEL.md)
- [Deployment and exact account steps](DEPLOYMENT.md)
- [Backup, restore, update and rollback](BACKUP_RESTORE.md)
- [Actual verification results](TEST_RESULTS.md)
- [Three-minute evaluator script](DEMO_SCRIPT.md)

## Important limitations
- No genuine station infrastructure, fuel, maintenance, inventory or shipment feed is integrated. Operational values stay absent until legitimate records are supplied.
- NASA data covers the grid near Maitri for 1–7 January 2024. It is historical reanalysis, not a station observation. No Bharati provider acquisition is claimed.
- NCPOR/IMD candidates are documented without inventing acquisition, usage permission or source observations.
- Asset topology, capacities and alert thresholds are illustrative; reachability is not a validated reliability or heat-flow model.
- Spare allocation, release and use are recorded against work orders. Automatic shipment receipt reconciliation is not yet implemented; record receipts in the inventory ledger.
- Authentication supports administrator-created accounts and expiring bearer tokens. SSO, MFA and self-service account recovery are not implemented.
- The public session API needs periodic retention cleanup and shared gateway limits if scaled. Snapshot APIs are suitable for the bounded prototype, not long-term high-volume telemetry.
- Storage supports a local persistent directory or private S3-compatible bucket. Managed storage, PostgreSQL backups and production restarts still need testing on the selected host.
- No offline write synchronization, autonomous AI actions, equipment controls or 3D surveyed layout are claimed.


## September 9 release: what changed
- Overview and Digital twin share a contrasting station schematic and persistent Evidence / Impact / Action inspector.
- Header: private overheat/recovery exercise, storm and resupply-delay scenarios; station-scoped search (Ctrl+K), presentation mode (Escape to exit), and low-bandwidth reads.
- Energy: configurable assumed target, sensitivity, fuel-ledger reconciliation and source drill-down.
- Logistics: Waste & retrograde area with evidence-based custody transitions; source records remain unverified.
- Service continuity traces heating, water, communications and essential loads to recorded supply dependencies.
- Original data, historical NASA sample, imports, authentication, maintenance and inventory workflows remain available. No station hardware names, measured satellite latency or official winter requirements have been invented.

### Updating an existing local installation
Back up the database and source-file storage using docs/BACKUP_RESTORE.md. Pull the reviewed code, retain your environment file, install the committed dependencies if changed, then run `.venv\Scripts\python -m alembic upgrade head` on Windows (or `.venv/bin/python -m alembic upgrade head` on Linux). Migrations 0003 and 0004 add waste and operations records without replacing saved records. Restart with `node scripts/dev.mjs`. The normal container startup also runs migrations. Do not downgrade destructively; restore a tested backup into a separate database when rolling back.

### Remaining integrations
The public URL is a browser demonstration. Full shared persistence, operational sign-in and uploads need the prepared FastAPI container plus managed PostgreSQL and durable storage. No hosting charges have been incurred. Actual equipment surveys, thermal calibration, computed satellite scheduling, validated ML, document-grounded model assistance, and durable offline synchronization remain future work. Generic rule explanations currently require no model credentials.

## Expedition enhancement release
See [the complete changes and connected team demonstration](EXPEDITION_RELEASE.md). Ten addressable pages, persistent light/dark/system themes, Antarctic context, crew/task/contact/research registers, shipment-linked planning, immutable handovers, record-backed questions and scientific screening/model workspaces are implemented. Scientific models are explicitly illustrative.
