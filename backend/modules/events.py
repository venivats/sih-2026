"""Small scoped revision stream backed by committed audit records.

No process-local pub/sub or shared in-memory state. Every reconnect checks the
current revision, so reconnecting after a missed event still reloads state.
"""
import asyncio,json
from sqlalchemy import select,func
from ..models import Audit,now

def revision(db,workspace,station):
    row=db.execute(select(func.count(Audit.id),func.max(Audit.created_at)).where(Audit.workspace==workspace,Audit.station==station)).one()
    return str(row[0])+':'+str(row[1] or '')

async def stream_revisions(factory,workspace,station,disconnected):
    previous=None
    # Finite stream works within function duration limits. Polling is still available.
    for tick in range(12):
        if await disconnected():break
        with factory() as db:current=revision(db,workspace,station)
        if current!=previous:
            yield 'event: refresh\ndata: '+json.dumps({'revision':current,'server_time':now()})+'\n\n'
            previous=current
        else:
            yield ': heartbeat\n\n'
        if tick<11:await asyncio.sleep(2)
