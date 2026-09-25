"""Export only shared demo records. Never exports operational/user workspaces."""
from pathlib import Path
import json
from backend.database import SessionLocal
from backend.main import snapshot
with SessionLocal() as db:
    for station in ['maitri','bharati']:
        data=snapshot('demo',station,{'sub':'public','role':'public'},db)
        Path('public/demo-'+station+'.json').write_text(json.dumps(data,indent=2))
