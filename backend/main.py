import os,time,logging,json
from uuid import uuid4
from typing import Literal
from fastapi import FastAPI,Depends,HTTPException,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select,text
from sqlalchemy.exc import IntegrityError
from fastapi.responses import JSONResponse
from .database import db_session
from .models import *
from .schemas import *
from .responses import *
from .common import scoped,serialize,record,audit
from .modules.access import actor,authorize,token,passwords
from .modules.telemetry import ingest
from .modules.maintenance import acknowledge,create_order,transition
from .seed import seed_workspace

app=FastAPI(title='POLARIS API',version='0.1.0',description='Independent SIH26060 engineering prototype. No equipment controls.')
app.add_middleware(CORSMiddleware,allow_origins=os.getenv('CORS_ORIGINS','http://localhost:4173,http://localhost:5173').split(','),allow_credentials=False,allow_methods=['GET','POST','PATCH'],allow_headers=['Authorization','Content-Type'])
Station=Literal['maitri','bharati']
log=logging.getLogger('polaris')
@app.middleware('http')
async def protections(request:Request,call_next):
    if request.headers.get('content-length','0').isdigit() and int(request.headers.get('content-length','0'))>2_200_000:
        return JSONResponse(status_code=413,content={'detail':'Maximum request size is 2 MB'})
    start=time.monotonic();response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Cache-Control']='no-store'
    log.info(json.dumps({'event':'http','method':request.method,'path':request.url.path,'status':response.status_code,'ms':round((time.monotonic()-start)*1000)}))
    return response
@app.exception_handler(IntegrityError)
async def conflict(request,exc): return JSONResponse(status_code=409,content={'detail':'Conflicting or duplicate record; reload and retry'})
@app.get('/api/health')
def health(db=Depends(db_session)):
    db.execute(text('SELECT 1'));return {'status':'ok','database':db.bind.dialect.name,'server_time':now()}
@app.post('/api/auth/token')
def login(form:OAuth2PasswordRequestForm=Depends(),db=Depends(db_session)):
    user=db.scalar(select(User).where(User.username==form.username))
    if not user or not passwords.verify(form.password,user.password_hash): raise HTTPException(401,'Incorrect username or password')
    return {'access_token':token(user.id,user.role),'token_type':'bearer','role':user.role}
@app.get('/api/auth/me')
def me(who=Depends(actor)): return {'role':who['role'],'workspace':who.get('workspace')}
@app.post('/api/demo-sessions')
def demo_session(db=Depends(db_session)):
    if os.getenv('ENABLE_PUBLIC_DEMO_SESSIONS','true')!='true': raise HTTPException(403,'Private demo sessions disabled')
    workspace='session-'+str(uuid4());seed_workspace(db,workspace,'session')
    return {'workspace':workspace,'access_token':token(workspace,'demo_operator',workspace),'role':'demo_operator','expires_in':7200}
@app.get('/api/w/{workspace}/{station}/snapshot',response_model=SnapshotOut)
def snapshot(workspace:str,station:Station,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace)
    models={'assets':Asset,'edges':Edge,'measurements':Measurement,'sources':Source,'rules':Rule,'alerts':Alert,'work_orders':WorkOrder,'inventory':Inventory,'ledger':Ledger,'shipments':Shipment,'audit':Audit,'replenishments':Replenishment,'acquisitions':Acquisition,'attachments':Attachment,'reservations':Reservation,'waste':WasteRecord,'operations':OpsRecord}
    return {'workspace':workspace,'station':station,'fetched_at':now(),**{key:[serialize(x) for x in db.scalars(scoped(db,model,workspace,station))] for key,model in models.items()}}
@app.post('/api/w/{workspace}/{station}/measurements',response_model=MeasurementOut)
def reading(workspace:str,station:Station,body:ReadingIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True)
    return serialize(ingest(db,workspace,station,body.model_dump(),who['sub']))
@app.post('/api/w/{workspace}/{station}/alerts/{id}/acknowledge',response_model=AlertOut)
def ack(workspace:str,station:Station,id:str,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);return serialize(acknowledge(db,workspace,station,id,who['sub']))
@app.post('/api/w/{workspace}/{station}/alerts/{id}/work-orders',response_model=WorkOrderOut)
def order(workspace:str,station:Station,id:str,body:OrderIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);return serialize(create_order(db,workspace,station,id,who['sub'],body.model_dump()))
@app.patch('/api/w/{workspace}/{station}/work-orders/{id}',response_model=WorkOrderOut)
def update_order(workspace:str,station:Station,id:str,body:TransitionIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);return serialize(transition(db,workspace,station,id,who['sub'],body.status,body.notes))

from .modules.logistics import transact,replenish,reserve,release
from .modules.energy import energy
from .modules.assets import impact
from .modules.scenarios import run
from .modules.ingestion import preview,commit_import
from .modules.provider import acquire
from .modules.storage import put_bytes,get_bytes
from fastapi import UploadFile,File,Form,Response

@app.get('/api/w/{workspace}/{station}/energy')
def energy_route(workspace:str,station:Station,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace);return energy(db,workspace,station)
@app.get('/api/w/{workspace}/{station}/assets/{id}/impact')
def impact_route(workspace:str,station:Station,id:str,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace);return impact(db,workspace,station,id)
@app.post('/api/w/{workspace}/{station}/scenarios')
def scenario_route(workspace:str,station:Station,body:ScenarioIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace);return run(db,workspace,station,body.model_dump())
@app.post('/api/w/{workspace}/{station}/inventory/transactions',response_model=LedgerOut)
def inventory_route(workspace:str,station:Station,body:LedgerIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);return serialize(transact(db,workspace,station,who['sub'],body.model_dump()))
@app.post('/api/w/{workspace}/{station}/reservations',response_model=ReservationOut)
def reserve_route(workspace:str,station:Station,body:ReservationIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);return serialize(reserve(db,workspace,station,who['sub'],body.model_dump()))
@app.post('/api/w/{workspace}/{station}/reservations/{id}/release',response_model=ReservationOut)
def release_route(workspace:str,station:Station,id:str,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);return serialize(release(db,workspace,station,id,who['sub']))
@app.post('/api/w/{workspace}/{station}/replenishments',response_model=ReplenishmentOut)
def replenishment_route(workspace:str,station:Station,body:ReplenishIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);return serialize(replenish(db,workspace,station,who['sub'],body.model_dump()))
@app.post('/api/w/{workspace}/{station}/assets',response_model=AssetOut)
def asset_route(workspace:str,station:Station,body:AssetIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True,admin=True)
    a=Asset(workspace=workspace,station=station,**body.model_dump(),position={},documentation=[]);db.add(a);db.flush();audit(db,workspace,station,who['sub'],'asset_registered',a.id,body.model_dump());return serialize(a)
@app.patch('/api/w/{workspace}/{station}/rules/{id}',response_model=RuleOut)
def rule_route(workspace:str,station:Station,id:str,body:RuleIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True,admin=True)
    if body.recovery_threshold>=body.threshold: raise HTTPException(422,'Recovery threshold must be below alert threshold')
    r=record(db,Rule,id,workspace,station,lock=True)
    for k,v in body.model_dump().items():setattr(r,k,v)
    r.streak=0;audit(db,workspace,station,who['sub'],'rule_updated',r.id,body.model_dump());return serialize(r)
@app.patch('/api/w/{workspace}/{station}/shipments/{id}',response_model=ShipmentOut)
def shipment_route(workspace:str,station:Station,id:str,body:ShipmentIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);r=record(db,Shipment,id,workspace,station,lock=True)
    transitions={'planned':['dispatched','delayed'],'dispatched':['in_transit','delayed'],'in_transit':['arrived','delayed'],'delayed':['dispatched','in_transit','arrived'],'arrived':[]}
    if body.status not in transitions[r.status]: raise HTTPException(409,'Invalid shipment status transition')
    r.status=body.status;r.history=[*r.history,{'at':now(),'status':body.status,'note':body.note,'actor':who['sub']}]
    audit(db,workspace,station,who['sub'],'shipment_updated',r.id,body.model_dump());return serialize(r)
@app.post('/api/w/{workspace}/{station}/imports/preview',response_model=ImportBatchOut)
async def import_preview(workspace:str,station:Station,file:UploadFile=File(...),title:str=Form(...,min_length=3,max_length=200),evidence:str=Form(...,min_length=5,max_length=1000),origin:Literal['observation','manual_entry','reanalysis','forecast','simulation']=Form(...),who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True,admin=True)
    raw=await file.read(2_000_001)
    return serialize(preview(db,workspace,station,who['sub'],raw,title,evidence,origin))
@app.post('/api/w/{workspace}/{station}/imports/{id}/commit',response_model=ImportBatchOut)
def import_commit(workspace:str,station:Station,id:str,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True,admin=True);return serialize(commit_import(db,workspace,station,who['sub'],id))
@app.get('/api/w/{workspace}/{station}/sources/{id}/original')
def original(workspace:str,station:Station,id:str,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace);r=record(db,Source,id,workspace,station)
    if not r.storage_key:raise HTTPException(404,'No original file attached to this source')
    return Response(get_bytes(r.storage_key),media_type='application/octet-stream',headers={'Content-Disposition':'attachment; filename="source-original.bin"'})
@app.post('/api/w/{workspace}/{station}/provider/nasa-power',response_model=AcquisitionOut)
def provider_route(workspace:str,station:Station,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True,admin=True);return serialize(acquire(db,workspace,station,who['sub']))
@app.post('/api/w/{workspace}/{station}/work-orders/{id}/attachments',response_model=AttachmentOut)
async def attachment_route(workspace:str,station:Station,id:str,file:UploadFile=File(...),who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True);record(db,WorkOrder,id,workspace,station)
    from pathlib import Path
    filename=Path(file.filename or 'attachment.txt').name
    if Path(filename).suffix.lower() not in ['.pdf','.txt','.md','.csv']:raise HTTPException(422,'Supported attachments: PDF, TXT, MD, CSV')
    raw=await file.read(2_000_001)
    if len(raw)>2_000_000:raise HTTPException(413,'Maximum attachment size is 2 MB')
    key,digest=put_bytes(workspace,raw)
    a=Attachment(workspace=workspace,station=station,work_order_id=id,filename=filename,storage_key=key,checksum=digest,uploader=who['sub']);db.add(a);db.flush();audit(db,workspace,station,who['sub'],'attachment_added',a.id,{'checksum':digest});return serialize(a)
@app.get('/api/w/{workspace}/{station}/attachments/{id}')
def get_attachment(workspace:str,station:Station,id:str,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace);a=record(db,Attachment,id,workspace,station)
    return Response(get_bytes(a.storage_key),media_type='application/octet-stream',headers={'Content-Disposition':'attachment; filename="attachment.bin"'})
@app.get('/api/w/{workspace}/{station}/events')
def events(workspace:str,station:Station,who=Depends(actor)):
    authorize(who,workspace)
    import asyncio
    from fastapi.responses import StreamingResponse
    async def stream():
        for _ in range(4):
            yield 'event: refresh\ndata: '+json.dumps({'server_time':now()})+'\n\n'
            await asyncio.sleep(15)
    return StreamingResponse(stream(),media_type='text/event-stream',headers={'X-Accel-Buffering':'no'})

from .modules.guards import RequestGuards
app.add_middleware(RequestGuards)
@app.post('/api/w/{workspace}/{station}/rules',response_model=RuleOut)
def create_rule(workspace:str,station:Station,body:RuleCreateIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True,admin=True);record(db,Asset,body.asset_id,workspace,station)
    from .modules.telemetry import UNITS
    if body.metric not in UNITS or body.recovery_threshold>=body.threshold:raise HTTPException(422,'Check metric and recovery threshold')
    r=Rule(workspace=workspace,station=station,**body.model_dump());db.add(r);db.flush();audit(db,workspace,station,who['sub'],'rule_created',r.id,body.model_dump());return serialize(r)
@app.post('/api/w/{workspace}/{station}/edges',response_model=EdgeOut)
def create_edge(workspace:str,station:Station,body:EdgeIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True,admin=True)
    record(db,Asset,body.upstream,workspace,station);record(db,Asset,body.downstream,workspace,station)
    if body.upstream==body.downstream:raise HTTPException(422,'Self-dependency is not supported')
    e=Edge(workspace=workspace,station=station,**body.model_dump(),verified=False);db.add(e);db.flush();audit(db,workspace,station,who['sub'],'dependency_added',e.id,body.model_dump());return serialize(e)
@app.post('/api/w/{workspace}/{station}/inventory',response_model=InventoryOut)
def create_inventory(workspace:str,station:Station,body:InventoryCreateIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True,admin=True)
    if body.asset_code and not db.scalar(scoped(db,Asset,workspace,station).where(Asset.code==body.asset_code)):raise HTTPException(422,'Asset code is not registered in this workspace')
    src=Source(workspace=workspace,station=station,title=body.name+' inventory setup',provider='Administrator manual entry',reference=body.evidence,origin='manual_entry',verification='unverified',parser_version='inventory-v1',transformations=['Empty item registered; subsequent ledger receipts establish stock'],licence='Usage rights supplied by administrator; unverified',uploader=who['sub'])
    db.add(src);db.flush();v=body.model_dump(exclude={'evidence'})
    item=Inventory(workspace=workspace,station=station,quantity=0,source_id=src.id,**v);db.add(item);db.flush();audit(db,workspace,station,who['sub'],'inventory_registered',item.id,v);return serialize(item)

@app.post('/api/w/{workspace}/{station}/exercises')
def exercise_route(workspace:str,station:Station,body:ExerciseIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True)
    from .modules.exercises import run_exercise
    return run_exercise(db,workspace,station,who['sub'],body.preset,body.idempotency_key)

@app.post('/api/w/{workspace}/{station}/waste',response_model=WasteOut)
def waste_create(workspace:str,station:Station,body:WasteIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True)
    from .modules.waste import register
    return serialize(register(db,workspace,station,who['sub'],body.model_dump()))
@app.patch('/api/w/{workspace}/{station}/waste/{id}',response_model=WasteOut)
def waste_update(workspace:str,station:Station,id:str,body:WasteTransitionIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True)
    from .modules.waste import transition as waste_transition
    return serialize(waste_transition(db,workspace,station,who['sub'],id,body.status,body.note))

from .modules.operations import OpsIn,OpsUpdate,AssignCrew
@app.post('/api/w/{workspace}/{station}/operations',response_model=OpsOut)
def ops_create(workspace:str,station:Station,body:OpsIn,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True)
    from .modules.operations import create
    return serialize(create(db,workspace,station,who['sub'],body))
@app.patch('/api/w/{workspace}/{station}/operations/{id}',response_model=OpsOut)
def ops_update(workspace:str,station:Station,id:str,body:OpsUpdate,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True)
    from .modules.operations import update
    return serialize(update(db,workspace,station,who['sub'],id,body))
@app.post('/api/w/{workspace}/{station}/work-orders/{id}/assign-crew',response_model=WorkOrderOut)
def assign_crew(workspace:str,station:Station,id:str,body:AssignCrew,who=Depends(actor),db=Depends(db_session)):
    authorize(who,workspace,write=True)
    from .modules.operations import assign
    return serialize(assign(db,workspace,station,who['sub'],id,body))

# The production image serves the compiled React app from the same origin.
from pathlib import Path
@app.get('/api/w/operational/{station}/official-weather')
def official_weather_status(station:Station,who=Depends(actor),db=Depends(db_session)):
    authorize(who,'operational')
    from .modules.official_weather import summary
    return summary(db,station)

@app.post('/api/w/operational/{station}/official-weather/refresh')
def official_weather_refresh(station:Station,who=Depends(actor),db=Depends(db_session)):
    authorize(who,'operational',write=True,admin=True)
    from .modules.official_weather import refresh,summary
    refresh(db,who['sub'])
    return summary(db,station)

from fastapi.staticfiles import StaticFiles
if Path('dist/index.html').is_file():
    from fastapi.responses import FileResponse
    @app.get('/stations/{route:path}')
    def station_page(route:str):return FileResponse('dist/index.html')
    app.mount('/',StaticFiles(directory='dist',html=True),name='frontend')
