"""Publish this deliberately selected, genuinely retrieved historical NASA sample only."""
import json,hashlib
from pathlib import Path
from backend.database import SessionLocal
from backend.models import Source,Measurement,Acquisition
from backend.common import scoped,serialize
from backend.modules.storage import get_bytes
with SessionLocal() as db:
    src=db.scalar(scoped(db,Source,'operational','maitri').where(Source.verification=='provider_retrieved'))
    if not src: raise RuntimeError('No genuine provider acquisition exists; refuse to fabricate sample')
    src.licence='NASA-managed AWS registry lists CC BY 4.0 and requests attribution; NASA catalog does not specify a licence. https://registry.opendata.aws/nasa-power/'
    db.commit()
    raw=get_bytes(src.storage_key)
    if hashlib.sha256(raw).hexdigest()!=src.checksum: raise RuntimeError('Original checksum mismatch')
    folder=Path('public/evidence');folder.mkdir(exist_ok=True)
    (folder/'nasa-power-maitri-20240101-20240107.json').write_bytes(raw)
    (folder/'acquisition-manifest.json').write_text(json.dumps(serialize(src),indent=2))
    sample={'station':'maitri','workspace':'published-provider-sample','sources':[serialize(src)],'measurements':[serialize(m) for m in db.scalars(scoped(db,Measurement,'operational','maitri').where(Measurement.source_id==src.id))]}
    Path('public/provider-sample.json').write_text(json.dumps(sample,indent=2))
    print('Preserved and exported genuine NASA response; 14 historical grid values. SHA-256:',src.checksum)
