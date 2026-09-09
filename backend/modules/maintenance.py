from fastapi import HTTPException
from ..common import record,audit
from ..models import Alert,WorkOrder

def acknowledge(db,w,s,id,actor):
    a=record(db,Alert,id,w,s,lock=True)
    if a.status=='open':
        a.status='acknowledged';a.acknowledged_by=actor
        audit(db,w,s,actor,'alert_acknowledged',a.id)
    return a

def create_order(db,w,s,id,actor,values):
    a=record(db,Alert,id,w,s,lock=True)
    if a.status=='open': raise HTTPException(409,'Acknowledge this alert first')
    from ..common import scoped
    existing=db.scalar(scoped(db,WorkOrder,w,s).where(WorkOrder.alert_id==id))
    if existing: return existing
    order=WorkOrder(workspace=w,station=s,alert_id=id,asset_id=a.asset_id,title='Inspect generator cooling circuit',**values)
    db.add(order);db.flush();audit(db,w,s,actor,'work_order_created',order.id,values)
    return order

def transition(db,w,s,id,actor,status,notes):
    from .logistics import workspace_lock
    from ..models import Reservation
    from ..common import scoped
    workspace_lock(db,w)
    order=record(db,WorkOrder,id,w,s,lock=True)
    if order.status==status: return order
    if status not in {'open':['in_progress'],'in_progress':['resolved'],'resolved':[]}[order.status]: raise HTTPException(409,'Invalid work-order transition')
    if status=='resolved' and (not notes or len(notes.strip())<10): raise HTTPException(422,'Describe the work and evidence in at least 10 characters')
    if status=='resolved' and db.scalar(scoped(db,Reservation,w,s).where(Reservation.work_order_id==id,Reservation.status=='reserved')):raise HTTPException(409,'Use or release allocated spares before resolving work')
    order.status=status
    if status=='resolved': order.resolution=notes
    audit(db,w,s,actor,'work_order_'+status,order.id,{'notes':notes,'sensor_recovery':'independent'})
    return order
