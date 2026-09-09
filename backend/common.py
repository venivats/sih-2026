from fastapi import HTTPException
from sqlalchemy import select
from .models import Audit

def scoped(db, model, workspace, station=None):
    q=select(model).where(model.workspace==workspace)
    return q.where(model.station==station) if station else q

def record(db, model, identity, workspace, station=None, lock=False):
    q=scoped(db,model,workspace,station).where(model.id==identity)
    obj=db.scalar(q.with_for_update() if lock else q)
    if not obj: raise HTTPException(404,'Record unavailable in this workspace')
    return obj

def audit(db, workspace, station, actor, action, entity, details=None):
    db.add(Audit(workspace=workspace,station=station,actor=actor,action=action,entity_id=entity,details=details or {}))

def serialize(obj):
    return {c.name:getattr(obj,c.name) for c in obj.__table__.columns}
