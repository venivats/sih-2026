"""Scoped crew, task, contact, research and immutable handover registers."""
from datetime import datetime, timezone, timedelta
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
class FieldPlanData(Strict):
    crew_id:str
    asset_id:str
    work_order_id:str|None=None
    centre_x:FiniteFloat=Field(ge=-5000,le=5000)
    centre_y:FiniteFloat=Field(ge=-5000,le=5000)
    radius_m:FiniteFloat=Field(ge=20,le=3000)
    restricted_x:FiniteFloat=Field(ge=-5000,le=5000)
    restricted_y:FiniteFloat=Field(ge=-5000,le=5000)
    restricted_radius_m:FiniteFloat=Field(ge=10,le=3000)
    check_in_due:str
    note:str=Field(min_length=10,max_length=2000)
class PositionData(Strict):
    crew_id:str
    plan_id:str
    x:FiniteFloat=Field(ge=-10000,le=10000)
    y:FiniteFloat=Field(ge=-10000,le=10000)
    accuracy_m:FiniteFloat=Field(ge=0,le=5000)
    observed_at:str
    device_id:str=Field(min_length=2,max_length=100)
class FieldEventData(Strict):
    check_in_due:str|None=None
    crew_id:str
    plan_id:str
    position_id:str|None=None
    event:Literal['check_in','contact_attempt','acknowledgement','inspection','sos','sos_resolved']
    note:str=Field(min_length=10,max_length=2000)
class ComparisonData(Strict):
    snapshot:dict
    daily_burn:FiniteFloat=Field(gt=0,le=100000)
    delay_days:FiniteFloat=Field(ge=0,le=365)
    reserve_litres:FiniteFloat=Field(ge=0,le=10000000)
    note:str=Field(min_length=10,max_length=2000)
class OpsIn(Strict):
    kind:Literal['crew','outdoor_task','contact','research','handover','field_plan','field_position','field_event','comparison']
    label:str=Field(min_length=2,max_length=150)
    data:dict
    idempotency_key:str=Field(min_length=8,max_length=100)
class OpsUpdate(Strict):
    version:int=Field(ge=0)
    data:dict
class AssignCrew(Strict):
    crew_id:str
    notes:str=Field(min_length=10,max_length=1000)
SCHEMAS={'crew':CrewData,'outdoor_task':TaskData,'contact':ContactData,'research':ResearchData,'handover':HandoverData,'field_plan':FieldPlanData,'field_position':PositionData,'field_event':FieldEventData,'comparison':ComparisonData}

def timestamp(v):
    try:
        d=datetime.fromisoformat(v.replace('Z','+00:00'))
        if d.tzinfo is None:raise ValueError()
        return d
    except (ValueError,TypeError,AttributeError):raise HTTPException(422,'Use a valid ISO timestamp with timezone')

def validate(db,w,s,kind,data):
    try:data=SCHEMAS[kind](**data).model_dump()
    except Exception as exc:raise HTTPException(422,'Invalid '+kind+' fields: '+str(exc)[:700])
    if kind in ('field_plan','field_position') and w=='operational':raise HTTPException(422,'Field geometry and positioning are simulation-only until a surveyed map and tracker integration are validated')
    for key in ['shift_start','shift_end','scheduled_at','starts_at','ends_at','check_in_due','observed_at']:
        if data.get(key) is not None:timestamp(data[key])
    for a,b in [('shift_start','shift_end'),('starts_at','ends_at')]:
        if a in data and timestamp(data[b])<=timestamp(data[a]):raise HTTPException(422,'End must be after start')
    for key in ['assignee_id','owner_id','crew_id']:
        if key in data:
            crew=record(db,OpsRecord,data[key],w,s)
            if crew.kind!='crew':raise HTTPException(422,'Select a crew record')
    if data.get('asset_id'):record(db,Asset,data['asset_id'],w,s)
    if data.get('shipment_id'):record(db,Shipment,data['shipment_id'],w,s)
    if data.get('work_order_id'):
        order=record(db,WorkOrder,data['work_order_id'],w,s)
        if order.asset_id!=data.get('asset_id'):raise HTTPException(422,'Work order must belong to the selected asset')
    if kind in ('field_position','field_event'):
        plan=record(db,OpsRecord,data['plan_id'],w,s)
        if plan.kind!='field_plan' or plan.data['crew_id']!=data['crew_id']:raise HTTPException(422,'Plan and crew do not match')
    if kind=='field_event' and data['event']=='check_in' and data.get('check_in_due')!=plan.data['check_in_due']:raise HTTPException(409,'Check-in deadline changed; reload the assignment')
    if data.get('position_id'):
        position=record(db,OpsRecord,data['position_id'],w,s)
        if position.kind!='field_position' or position.data['plan_id']!=data['plan_id']:raise HTTPException(422,'Position and plan do not match')
    if kind=='field_position' and timestamp(data['observed_at'])>datetime.now(timezone.utc)+timedelta(seconds=60):raise HTTPException(422,'Position timestamp is in the future')
    if kind in ('handover','comparison') and (data['snapshot'].get('workspace')!=w or data['snapshot'].get('station')!=s):raise HTTPException(422,'Snapshot must match workspace and station')
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
    if row.kind in ('handover','field_position','field_event','comparison'):raise HTTPException(409,'Saved evidence is immutable; create a new record')
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
