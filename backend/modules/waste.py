"""Retrograde custody records, without a claim of regulatory certification."""
from fastapi import HTTPException
from ..models import WasteRecord, Shipment, now
from ..common import scoped, record, audit

def register(db,w,s,actor,data):
    old=db.scalar(scoped(db,WasteRecord,w,s).where(WasteRecord.idempotency_key==data['idempotency_key']))
    if old:
        if any(getattr(old,k)!=v for k,v in data.items()):raise HTTPException(409,'Idempotency key reused')
        return old
    expected='each' if data['category']=='empty_fuel_drums' else 'kg'
    if data['unit']!=expected or (expected=='each' and not data['quantity'].is_integer()):
        raise HTTPException(422,'Use integer each for drums and kg for other categories')
    if data['shipment_id']:record(db,Shipment,data['shipment_id'],w,s)
    origin='manual_entry' if w=='operational' else 'simulation'
    r=WasteRecord(workspace=w,station=s,**data,origin=origin,history=[dict(at=now(),status='collected',note=data['evidence'],actor=actor)])
    db.add(r);db.flush();audit(db,w,s,actor,'waste_registered',r.id,dict(category=r.category,quantity=r.quantity,origin=origin));return r

def transition(db,w,s,actor,id,status,note):
    r=record(db,WasteRecord,id,w,s,lock=True)
    if dict(collected='packed',packed='loaded',loaded='returned').get(r.status)!=status:
        raise HTTPException(409,'Follow custody sequence: collected, packed, loaded, returned')
    if status=='loaded' and not r.shipment_id:raise HTTPException(409,'A registered shipment is required before loading')
    r.status=status;r.history=[*r.history,dict(at=now(),status=status,note=note,actor=actor)]
    audit(db,w,s,actor,'waste_'+status,r.id,dict(note=note));return r
