"""Run the fixed official provider connector and preserve its acquisition result."""
import json
from pathlib import Path
from backend.database import SessionLocal
from backend.modules.provider import acquire
from backend.common import serialize
with SessionLocal() as db:
    r=acquire(db,'operational','maitri','project-initialization')
    db.commit()
    Path('docs/acquisition-result.json').write_text(json.dumps(serialize(r),indent=2))
    print(r.status,r.detail)
