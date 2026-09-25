# Backup, restore, update and rollback

Back up both PostgreSQL and original files. A database-only backup cannot reconstruct uploaded bytes. Stop writes for a coordinated backup unless the managed providers offer a tested consistent snapshot method.

## Docker Compose backup
Run from PowerShell in the source folder. Use a new dated folder; the examples avoid piping binary dump output through PowerShell.

```powershell
New-Item -ItemType Directory -Force backups\checkpoint-01
docker compose stop app
docker compose exec db pg_dump -U polaris -d polaris -Fc -f /tmp/polaris.dump
docker compose cp db:/tmp/polaris.dump backups/checkpoint-01/polaris.dump
docker compose run --rm --no-deps -v "${PWD}/backups/checkpoint-01:/backup" app python -c "import tarfile; t=tarfile.open('/backup/source-files.tar.gz','w:gz'); t.add('/app/storage',arcname='files'); t.close()"
docker compose start app
```

The file archive is written outside the source volume to avoid self-inclusion. Keep these backups outside the application host and restrict access. Verify them before relying on them.

## Portable file and SQLite helper

```powershell
.\.venv\Scripts\python.exe scripts/backup.py backup --database polaris.db --storage storage --destination backups/checkpoint-01
.\.venv\Scripts\python.exe scripts/backup.py verify --destination backups/checkpoint-01
.\.venv\Scripts\python.exe scripts/backup.py restore --destination backups/checkpoint-01 --database restored/polaris.db --storage restored/storage
```

This helper uses SQLite's backup API and SHA-256 verification for local development. Restore refuses existing output paths. The SQLite backup/restore test passes; this is not evidence that managed PostgreSQL backups were tested.

## PostgreSQL restore rehearsal (fresh database)
Provision a new empty PostgreSQL database and fresh file volume or bucket. Keep the original application/database untouched. Copy the dump into the test database container, then run:

```powershell
docker compose cp backups/checkpoint-01/polaris.dump db:/tmp/restore.dump
docker compose exec db createdb -U polaris polaris_restore_test
docker compose exec db pg_restore -U polaris -d polaris_restore_test --no-owner /tmp/restore.dump
```

Restore file bytes into a **new** storage location. Point a separate test application at the restored database and file store, authenticate, inspect a known work order, download a source and compare its checksum. Record record counts and hashes. Never run a restore over production to “test” a backup. Use provider database point-in-time recovery only after verifying its plan-specific retention and procedure.

## Updates
1. Commit and tag the current working source.
2. Take and verify a coordinated backup.
3. Build and test the candidate. Run migrations on a copy first; review additive migration SQL and test that saved records survive.
4. Deploy the new image against persistent resources. Initialization does not replace saved records.
5. Check health, permissions, file retrieval and a known saved record after restart.

## Rollback
Redeploy the previous image only when it is compatible with the current schema. Keep migrations additive to make this possible. Do not blindly downgrade or delete schema/data. If schema compatibility is lost, restore the tested backup into new resources, verify, then switch the application connection. Record the recovery point and any later writes that need reconciliation. Never claim lossless rollback without such reconciliation.
