import csv,io,math
from fastapi import HTTPException
from ..models import Source,Asset,Measurement,ImportBatch
from ..common import scoped,record,audit
from .telemetry import timestamp,UNITS,ingest
from .storage import put_bytes

COLUMNS=['station','asset_code','metric','value','unit','observed_at']
def preview(db,w,s,actor,raw,title,evidence,origin):
    if len(raw)>2_000_000: raise HTTPException(413,'CSV exceeds 2 MB')
    if w=='operational' and origin=='simulation': raise HTTPException(422,'Operational workspace cannot contain simulation imports')
    key,checksum=put_bytes(w,raw)
    source=Source(workspace=w,station=s,title=title,provider='Administrator-supplied file',reference=evidence,origin=origin,verification='unverified',checksum=checksum,parser_version='csv-v1',transformations=['UTF-8 CSV decoded; ISO timestamps normalized to UTC; empty values retained as null; historical imports do not trigger current alerts'],storage_key=key,uploader=actor,licence='Uploader is responsible for documenting usage rights; not independently verified')
    db.add(source);db.flush();rows=[];errors=[];seen=set()
    try:
        reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
        if reader.fieldnames!=COLUMNS: errors.append({'row':1,'message':'Expected columns in order: '+','.join(COLUMNS)})
        else:
            for number,row in enumerate(reader,2):
                if number>1001: errors.append({'row':number,'message':'Maximum 1000 data rows'});break
                try:
                    if None in row or any(v is None for v in row.values()): raise ValueError('Column count does not match schema')
                    if row['station']!=s: raise ValueError('Station does not match selected station')
                    asset=db.scalar(scoped(db,Asset,w,s).where(Asset.code==row['asset_code']))
                    if not asset: raise ValueError('Unknown asset code; register the asset in this workspace first')
                    if UNITS.get(row['metric'])!=row['unit']: raise ValueError('Unknown metric or incorrect unit')
                    value=float(row['value']) if row['value'].strip() else None
                    if value is not None and not math.isfinite(value): raise ValueError('NaN and infinity are prohibited')
                    t=timestamp(row['observed_at']);ident=(asset.id,row['metric'],t)
                    if ident in seen: raise ValueError('Duplicate reading within file')
                    seen.add(ident)
                    if db.scalar(scoped(db,Measurement,w,s).where(Measurement.asset_id==asset.id,Measurement.metric==row['metric'],Measurement.observed_at==t)): raise ValueError('Reading already exists in database')
                    rows.append({'asset_id':asset.id,'metric':row['metric'],'value':value,'unit':row['unit'],'observed_at':t,'source_id':source.id})
                except ValueError as e: errors.append({'row':number,'message':str(e)})
    except (UnicodeDecodeError,csv.Error) as e: errors.append({'row':1,'message':'Invalid UTF-8 CSV: '+str(e)[:120]})
    if not rows and not errors: errors.append({'row':2,'message':'No data rows'})
    batch=ImportBatch(workspace=w,station=s,source_id=source.id,rows=rows,errors=errors,status='rejected' if errors else 'preview')
    db.add(batch);db.flush();audit(db,w,s,actor,'import_preview',batch.id,{'checksum':checksum,'valid_rows':len(rows),'errors':len(errors)})
    return batch

def commit_import(db,w,s,actor,id):
    batch=record(db,ImportBatch,id,w,s,lock=True)
    if batch.status=='imported': return batch
    if batch.errors or batch.status!='preview': raise HTTPException(422,'Fix every validation error and upload a new file')
    # The endpoint owns one database transaction: any conflicting row rolls back all rows.
    for row in batch.rows: ingest(db,w,s,row,actor,evaluate=False)
    batch.status='imported';audit(db,w,s,actor,'import_committed',batch.id,{'rows':len(batch.rows),'source_id':batch.source_id})
    return batch
