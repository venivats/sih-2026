"""Deterministic engineering demonstration. Never copies records into operational workspace."""
import math,os
from datetime import datetime,timedelta,timezone
from sqlalchemy import select
from .models import *
from .modules.access import passwords
from .modules.telemetry import ingest

ASSETS=[('FUEL','Fuel storage','fuel',0,120,False,42000,'L'),('GEN-A','Primary generator','generator',1,40,True,250,'kW'),('GEN-B','Standby generator','generator',1,215,True,180,'kW'),('BUS','Electrical distribution','distribution',2,40,True,None,None),('BAT','Battery reserve','battery',2,215,True,120,'kWh'),('HVAC','Heating & ventilation','heating',3,40,True,None,None),('WATER','Water treatment','water',3,215,True,None,None),('COMMS','Communications','communications',4,40,True,None,None),('LOAD','Essential loads','load',4,215,True,None,None),('ENV','Environment monitor','environment',0,300,False,None,None)]
EDGES=[('FUEL','GEN-A','fuel',False),('FUEL','GEN-B','fuel',True),('GEN-A','BUS','electricity',False),('GEN-B','BUS','electricity',True),('BAT','BUS','electricity',True),('BUS','HVAC','electricity',False),('BUS','WATER','electricity',False),('BUS','COMMS','electricity',False),('BUS','LOAD','electricity',False),('HVAC','LOAD','heat',False)]
def seed_workspace(db,w,kind='demo'):
    if w=='operational': raise ValueError('Demo seeding into operational is prohibited')
    if db.get(Workspace,w): return
    db.add(Workspace(id=w,kind=kind));db.flush()
    for station in ['maitri','bharati']:
        src=Source(workspace=w,station=station,title='POLARIS deterministic engineering demonstration v1',provider='POLARIS project team',reference='docs/DEMO_MODEL.md',origin='simulation',verification='illustrative',parser_version='seed-v1',transformations=['Deterministic synthetic hourly examples; no scientific observations'],licence='Project-authored demonstration data; CC0-1.0')
        db.add(src);db.flush();assets={}
        for code,name,k,x,y,critical,capacity,unit in ASSETS:
            a=Asset(workspace=w,station=station,code=code,name=name,kind=k,critical=critical,capacity=(280 if station=="bharati" and code=="GEN-A" else capacity),capacity_unit=unit,position={'x':x,'y':y},documentation=[{'title':'Illustrative asset and capacity assumptions','url':'/docs/DEMO_MODEL.md'}])
            db.add(a);db.flush();assets[code]=a
        for a,b,k,backup in EDGES: db.add(Edge(workspace=w,station=station,upstream=assets[a].id,downstream=assets[b].id,relationship=k,backup=backup))
        rule=Rule(workspace=w,station=station,asset_id=assets['GEN-A'].id,metric='coolant_temperature',threshold=90,recovery_threshold=85,debounce=2,assumption='Illustrative only: two consecutive readings above 90 degC open an alert; reading at or below 85 degC recovers it. Not manufacturer guidance.')
        db.add(rule);db.flush()
        offset=0 if station=='maitri' else 18
        for h in range(25):
            t=(datetime(2026,9,5,tzinfo=timezone.utc)+timedelta(hours=h)).isoformat()
            for code,metric,value in [('GEN-A','generation',round(235+8*math.sin(h/4)+offset,1)),('BUS','consumption',round(202+13*math.sin(h/4+0.7)+offset,1)),('GEN-A','coolant_temperature',round(78+h*.3 if h<21 else 87+(h-21)*2.3,1)),('BAT','soc',78),('FUEL','fuel_burn',780+offset*2),('ENV','temperature',None if h in [8,9] else round(-22+3*math.sin(h/6)-offset/5,1)),('ENV','wind_speed',round(9+3*math.cos(h/4),1))]:
                from .modules.telemetry import UNITS
                ingest(db,w,station,{'asset_id':assets[code].id,'source_id':src.id,'metric':metric,'value':value,'unit':UNITS[metric],'observed_at':t,'quality':'synthetic'},'seed-v1')
        for name,cat,loc,q,unit,threshold,code in [('Polar diesel','fuel','Fuel store F-01',28400-offset*120,'L',15000,'FUEL'),('Coolant filter','spare','Technical store / A-04',3,'each',4,'GEN-A'),('Water treatment cartridge','spare','Technical store / B-02',8,'each',3,'WATER'),('Dry provisions','provisions','Main store',1250,'kg',600,None),('Medical supplies','medical','Clinic',48,'kits',20,None)]:
            item=Inventory(workspace=w,station=station,name=name,category=cat,location=loc,quantity=q,unit=unit,reorder_point=threshold,asset_code=code,source_id=src.id)
            db.add(item);db.flush()
            db.add(Ledger(workspace=w,station=station,item_id=item.id,delta=q,balance=q,kind='opening',reason='Illustrative opening inventory',actor='seed-v1',idempotency_key=item.id))
        db.add(Shipment(workspace=w,station=station,name='Summer resupply / DEMO-027',eta='2026-11-20',status='planned',risk='Illustrative schedule. Weather and vessel availability are unverified.',manifest=[{'name':'Polar diesel','quantity':18000,'unit':'L'},{'name':'Coolant filter','quantity':12,'unit':'each'}],history=[{'at':'2026-09-05T12:00:00+00:00','status':'planned','note':'Synthetic planning record'}]))

def initialize(db):
    if not db.get(Workspace,'operational'): db.add(Workspace(id='operational',kind='operational'))
    seed_workspace(db,'demo')
    username=os.getenv('ADMIN_USERNAME');password=os.getenv('ADMIN_PASSWORD')
    if username and password and not db.scalar(select(User).where(User.username==username)):
        if len(password)<12: raise ValueError('ADMIN_PASSWORD must be at least 12 characters')
        db.add(User(username=username,password_hash=passwords.hash(password),role='administrator'))
    db.commit()
if __name__=='__main__':
    from .database import SessionLocal
    with SessionLocal() as db: initialize(db)
