"""Reversible local-development backup/restore, with per-file integrity checks."""
import argparse,hashlib,json,sqlite3,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('action',choices=['backup','verify','restore']);p.add_argument('--database',default='polaris.db');p.add_argument('--storage',default='storage');p.add_argument('--destination',required=True);a=p.parse_args()
dest=Path(a.destination)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    manifest=json.loads((dest/'manifest.json').read_text())
    for name,h in manifest.items():
        path=(dest/name).resolve()
        if not path.is_relative_to(dest.resolve()) or not path.is_file() or digest(path)!=h:raise SystemExit('Backup verification failed: '+name)
    print('Verified',len(manifest),'backup files.');return manifest
if a.action=='backup':
    if dest.exists():raise SystemExit('Choose a new backup directory; existing files will not be overwritten.')
    dest.mkdir(parents=True)
    with sqlite3.connect(a.database) as original,sqlite3.connect(dest/'database.db') as target:original.backup(target)
    if Path(a.storage).exists():shutil.copytree(a.storage,dest/'files')
    manifest={str(x.relative_to(dest)):digest(x) for x in dest.rglob('*') if x.is_file()}
    (dest/'manifest.json').write_text(json.dumps(manifest,indent=2));verify()
elif a.action=='verify':verify()
else:
    manifest=verify();db=Path(a.database);storage=Path(a.storage)
    if db.exists() or storage.exists():raise SystemExit('Restore requires new database and storage paths. Nothing changed.')
    db.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest/'database.db',db)
    if (dest/'files').exists():shutil.copytree(dest/'files',storage)
    print('Restored to new paths; original data remains untouched.')
