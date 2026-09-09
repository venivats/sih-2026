from fastapi import HTTPException
from sqlalchemy import update
from ..models import Workspace,Inventory,Ledger,WorkOrder,Replenishment,Asset,Reservation
from ..common import record,scoped,audit

def workspace_lock(db,w):
    # Row-level lock on PostgreSQL; write lock on SQLite. Orders all ledger writes
    # including duplicate keys before reading balances. Never rely on frontend stock.
    db.execute(update(Workspace).where(Workspace.id==w).values(created_at=Workspace.created_at))

def transact(db,w,s,actor,v):
    workspace_lock(db,w)
    existing=db.scalar(scoped(db,Ledger,w).where(Ledger.idempotency_key==v['idempotency_key']))
    if existing:
        if any(getattr(existing,k)!=v.get(k) for k in ['item_id','delta','kind','reason','work_order_id']): raise HTTPException(409,'Idempotency key reused for a different transaction')
        return existing
    item=record(db,Inventory,v['item_id'],w,s,lock=True)
    delta=v['delta'];kind=v['kind']
    if delta==0: raise HTTPException(422,'Quantity change cannot be zero')
    if (kind in ['issue','spare_use'] and delta>=0) or (kind=='receipt' and delta<=0): raise HTTPException(422,'Transaction direction conflicts with its type')
    if item.unit in ['each','kits'] and delta!=int(delta): raise HTTPException(422,'Whole units required')
    if item.quantity+delta<0: raise HTTPException(409,'Insufficient stock; no quantity changed')
    if kind=='spare_use' and not v.get('work_order_id'): raise HTTPException(422,'Spare use requires a work order')
    if v.get('work_order_id'):
        order=record(db,WorkOrder,v['work_order_id'],w,s,lock=True)
        if item.asset_code and record(db,Asset,order.asset_id,w,s).code!=item.asset_code: raise HTTPException(422,'Spare is linked to a different asset')
        if order.status!='in_progress': raise HTTPException(409,'Spare use requires an in-progress work order')
    reservations=list(db.scalars(scoped(db,Reservation,w,s).where(Reservation.item_id==item.id,Reservation.status=='reserved')))
    own=[r for r in reservations if kind=='spare_use' and r.work_order_id==v.get('work_order_id')]
    protected=sum(r.remaining for r in reservations if r not in own)
    if item.quantity+delta<protected: raise HTTPException(409,'Stock is reserved for maintenance; release it before issuing')
    to_use=-delta if kind=='spare_use' else 0
    for r in own:
        used=min(to_use,r.remaining);r.remaining-=used;to_use-=used
        if r.remaining==0:r.status='used'
    item.quantity=round(item.quantity+delta,6);item.version+=1
    entry=Ledger(workspace=w,station=s,actor=actor,balance=item.quantity,**v)
    db.add(entry);db.flush();audit(db,w,s,actor,'inventory_'+kind,entry.id,{'item_id':item.id,'delta':delta,'balance':item.quantity})
    return entry

def reserve(db,w,s,actor,v):
    workspace_lock(db,w)
    existing=db.scalar(scoped(db,Reservation,w,s).where(Reservation.idempotency_key==v['idempotency_key']))
    if existing:
        if any(getattr(existing,k)!=v[k] for k in ['item_id','work_order_id','quantity']):raise HTTPException(409,'Idempotency key reused')
        return existing
    item=record(db,Inventory,v['item_id'],w,s,lock=True)
    order=record(db,WorkOrder,v['work_order_id'],w,s,lock=True)
    if order.status=='resolved':raise HTTPException(409,'Cannot reserve for resolved work')
    if item.category!='spare':raise HTTPException(422,'Only spare parts may be allocated to work orders')
    if item.asset_code and record(db,Asset,order.asset_id,w,s).code!=item.asset_code:raise HTTPException(422,'Spare is linked to another asset')
    if item.unit in ['each','kits'] and v['quantity']!=int(v['quantity']):raise HTTPException(422,'Whole units required')
    allocated=sum(r.remaining for r in db.scalars(scoped(db,Reservation,w,s).where(Reservation.item_id==item.id,Reservation.status=='reserved')))
    if v['quantity']>item.quantity-allocated:raise HTTPException(409,'Insufficient unreserved stock')
    r=Reservation(workspace=w,station=s,actor=actor,remaining=v['quantity'],**v);db.add(r);db.flush()
    audit(db,w,s,actor,'spare_reserved',r.id,v);return r

def release(db,w,s,id,actor):
    workspace_lock(db,w);r=record(db,Reservation,id,w,s,lock=True)
    if r.status=='reserved':
        r.status='released';r.remaining=0;audit(db,w,s,actor,'spare_released',r.id)
    return r

def replenish(db,w,s,actor,v):
    workspace_lock(db,w);record(db,Inventory,v['item_id'],w,s)
    same=db.scalar(scoped(db,Replenishment,w).where(Replenishment.idempotency_key==v['idempotency_key']))
    if same:
        if same.item_id!=v['item_id'] or same.quantity!=v['quantity']: raise HTTPException(409,'Idempotency key reused')
        return same
    pending=db.scalar(scoped(db,Replenishment,w,s).where(Replenishment.item_id==v['item_id'],Replenishment.status=='requested'))
    if pending: raise HTTPException(409,'A replenishment request for this item is already open')
    r=Replenishment(workspace=w,station=s,requested_by=actor,**v);db.add(r);db.flush();audit(db,w,s,actor,'replenishment_requested',r.id,v)
    return r
