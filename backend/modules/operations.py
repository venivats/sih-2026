"""Scoped crew, task, contact, research and immutable handover registers."""
from datetime import datetime
from typing import Literal
from pydantic import Field,FiniteFloat,model_validator
from fastapi import HTTPException
from ..schemas import Strict
from ..models import OpsRecord,WorkOrder,Asset,Shipment,now
from ..common import scoped,record,audit

class CrewData(Strict):
    role:str=Field(min_length=2,max_length=100)
    status:Literal['on_duty','off_duty','rotation_due']='on_duty'
    shift_start:str
    shift_end:str
class TaskData(Strict):
    assignee_id:str
    shipment_id:str|None=None
    status:Literal['planned','on_hold','completed']='planned'
    wind_limit_ms:FiniteFloat=Field(gt=0,le=100)
    scheduled_at:str
    note:str=Field(min_length=10,max_length=2000)
class ContactData(Strict):
    assignee_id:str
    starts_at:str
    ends_at:str
    status:Literal['planned','completed','missed']='planned'
    note:str=Field(min_length=10,max_length=2000)
class ResearchData(Strict):
    asset_id:str
    owner_id:str
    interruption_hours:FiniteFloat=Field(ge=0,le=8760)
    note:str=Field(min_length=10,max_length=2000)
class HandoverData(Strict):
    text:str=Field(min_length=20,max_length=20000)
    snapshot:dict
    model_version:Literal['handover-v1']='handover-v1'
class OpsIn(Strict):
    kind:Literal['crew','outdoor_task','contact','research','handover']
    label:str=Field(min_length=2,max_length=150)
    data:dict
    idempotency_key:str=Field(min_length=8,max_length=100)
class OpsUpdate(Strict):
    version:int=Field(ge=0)
    data:dict
class AssignCrew(Strict):
    crew_id:str
    notes:str=Field(min_length=10,max_length=1000)
SCHEMAS={'crew':CrewData,'outdoor_task':TaskData,'contact':ContactData,'research':ResearchData,'handover':HandoverData}

def timestamp(v):
    try:
        d=datetime.fromisoformat(v.replace('Z','+00:00'))
        if d.tzinfo is None:raise ValueError()
        return d
    except (ValueError,TypeError,AttributeError):raise HTTPException(422,'Use a valid ISO timestamp with timezone')

def validate(db,w,s,kind,data):
    try:data=SCHEMAS[kind](**data).model_dump()
    except Exception as exc:raise HTTPException(422,'Invalid '+kind+' fields: '+str(exc)[:700])
    for key in ['shift_start','shift_end','scheduled_at','starts_at','ends_at']:
        if key in data:timestamp(data[key])
    for a,b in [('shift_start','shift_end'),('starts_at','ends_at')]:
        if a in data and timestamp(data[b])<=timestamp(data[a]):raise HTTPException(422,'End must be after start')
    for key in ['assignee_id','owner_id']:
        if key in data:
            crew=record(db,OpsRecord,data[key],w,s)
            if crew.kind!='crew':raise HTTPException(422,'Select a crew record')
    if data.get('asset_id'):record(db,Asset,data['asset_id'],w,s)
    if data.get('shipment_id'):record(db,Shipment,data['shipment_id'],w,s)
    if kind=='handover' and (data['snapshot'].get('workspace')!=w or data['snapshot'].get('station')!=s):raise HTTPException(422,'Handover snapshot must match workspace and station')
    return data

def create(db,w,s,actor,body):
    data=validate(db,w,s,body.kind,body.data)
    old=db.scalar(scoped(db,OpsRecord,w,s).where(OpsRecord.idempotency_key==body.idempotency_key))
    if old:
        if old.kind!=body.kind or old.label!=body.label or old.data!=data:raise HTTPException(409,'Idempotency key reused')
        return old
    row=OpsRecord(workspace=w,station=s,kind=body.kind,label=body.label,data=data,idempotency_key=body.idempotency_key,origin='manual_entry' if w=='operational' else 'simulation')
    db.add(row);db.flush();audit(db,w,s,actor,'operations_created',row.id,dict(kind=row.kind,label=row.label));return row

def update(db,w,s,actor,id,body):
    row=record(db,OpsRecord,id,w,s,lock=True)
    if row.kind=='handover':raise HTTPException(409,'Saved handovers are immutable; create a new report')
    if row.version!=body.version:raise HTTPException(409,'Record changed. Reload before saving')
    data=validate(db,w,s,row.kind,body.data)
    old=row.data;row.data=data;row.version+=1
    audit(db,w,s,actor,'operations_updated',row.id,dict(before=old,after=data,version=row.version));return row

def assign(db,w,s,actor,id,body):
    order=record(db,WorkOrder,id,w,s,lock=True);crew=record(db,OpsRecord,body.crew_id,w,s)
    if order.status=='resolved':raise HTTPException(409,'Resolved work cannot be reassigned')
    if crew.kind!='crew' or crew.data['status']!='on_duty':raise HTTPException(409,'Crew member is unavailable')
    if not crew.data['shift_start'][:10]<=order.due_date<=crew.data['shift_end'][:10]:raise HTTPException(409,'Work due date lies outside registered duty period')
    order.assignee=crew.label;audit(db,w,s,actor,'crew_assigned',order.id,dict(crew_id=crew.id,notes=body.notes));return order
