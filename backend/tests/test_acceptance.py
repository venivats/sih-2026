import os,hashlib,subprocess,sys,sqlite3
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import select,func
from backend.models import *
from backend.modules.access import token,passwords
from backend.modules.ingestion import preview,commit_import
from backend.modules.storage import get_bytes
from backend.modules.logistics import transact
from backend.seed import initialize
from backend.tests.test_workflow import client,private
from fastapi import HTTPException
import pytest

def admin(Session):
    with Session() as db:
        u=User(username='test-admin',password_hash=passwords.hash('Test-passphrase-42'),role='administrator');db.add(u);db.commit()
        return {'Authorization':'Bearer '+token(u.id,u.role)}

def test_public_mutations_denied(client):
    c,Session=client;d=c.get('/api/w/demo/maitri/snapshot').json()
    assert c.post('/api/w/demo/maitri/alerts/'+d['alerts'][0]['id']+'/acknowledge').status_code==403
    assert c.get('/api/w/operational/maitri/snapshot').status_code==403
    assert c.post('/api/w/operational/maitri/provider/nasa-power').status_code==403

def test_demo_isolation_and_missing_data(client):
    c,Session=client;h=admin(Session)
    snap=c.get('/api/w/operational/maitri/snapshot',headers=h).json()
    assert snap['measurements']==[] and snap['inventory']==[] and snap['assets']==[]
    result=c.get('/api/w/operational/maitri/energy',headers=h).json()
    assert result['generation_kw'] is None and result['autonomy_days'] is None
    base,guest=private(c)
    assert c.get('/api/w/operational/maitri/snapshot',headers=guest).status_code==403

def test_two_visitors_independent(client):
    c,Session=client;a,ha=private(c);b,hb=private(c)
    snap=c.get(a+'/snapshot',headers=ha).json();id=snap['alerts'][0]['id']
    assert c.get(a+'/snapshot',headers=hb).status_code==403
    c.post(a+'/alerts/'+id+'/acknowledge',headers=ha)
    assert c.get(b+'/snapshot',headers=hb).json()['alerts'][0]['status']=='open'
    assert c.post(b+'/alerts/'+id+'/acknowledge',headers=hb).status_code==404

def test_inventory_idempotency_and_negative_stock(client):
    c,Session=client;base,h=private(c);item=c.get(base+'/snapshot',headers=h).json()['inventory'][1]
    payload={'item_id':item['id'],'delta':-1,'kind':'issue','reason':'Test stock issue','idempotency_key':'repeat-key-123'}
    a=c.post(base+'/inventory/transactions',headers=h,json=payload);b=c.post(base+'/inventory/transactions',headers=h,json=payload)
    assert a.status_code==200 and b.json()['id']==a.json()['id']
    payload['delta']=-(item['quantity']+100);payload['idempotency_key']='negative-test'
    assert c.post(base+'/inventory/transactions',headers=h,json=payload).status_code==409
    current=next(i for i in c.get(base+'/snapshot',headers=h).json()['inventory'] if i['id']==item['id'])
    assert current['quantity']==item['quantity']-1

def test_concurrent_inventory_requests(client):
    c,Session=client;base,h=private(c);d=c.get(base+'/snapshot',headers=h).json();item=next(i for i in d['inventory'] if i['name']=='Coolant filter')
    def issue(i):
        try:
            with Session() as db:
                r=transact(db,d['workspace'],'maitri','test',{'item_id':item['id'],'delta':-2,'kind':'issue','reason':'Concurrent stock request','work_order_id':None,'idempotency_key':'concurrent-'+str(i)});db.commit();return r.balance
        except HTTPException as e:return e.status_code
    with ThreadPoolExecutor(max_workers=2) as pool: result=list(pool.map(issue,[1,2]))
    assert sorted(result)==[1,409]
    with Session() as db:assert db.get(Inventory,item['id']).quantity==1

def setup_import(Session,tmp_path):
    os.environ['STORAGE_PATH']=str(tmp_path/'uploads')
    with Session() as db:
        a=Asset(workspace='operational',station='maitri',code='ENV',name='Environment instrument',kind='environment');db.add(a);db.commit()
    return 'station,asset_code,metric,value,unit,observed_at\n'

def test_invalid_csv_preserves_original(client,tmp_path):
    c,Session=client;header=setup_import(Session,tmp_path)
    raw=(header+'maitri,ENV,temperature,NaN,degC,2026-01-01T00:00:00Z\n'+'bharati,ENV,temperature,4,degC,2026-01-01T00:00:00Z\n'+'maitri,ENV,temperature,4,degC,2026-01-01T00:00:00\n').encode()
    with Session() as db:
        batch=preview(db,'operational','maitri','test',raw,'Uploaded observations','Instrument log reference','observation');db.commit()
        assert len(batch.errors)==3
        source=db.get(Source,batch.source_id)
        assert get_bytes(source.storage_key)==raw and source.checksum==hashlib.sha256(raw).hexdigest()
        assert source.verification=='unverified'
        with pytest.raises(HTTPException):commit_import(db,'operational','maitri','test',batch.id)
        assert db.scalar(select(func.count()).select_from(Measurement).where(Measurement.workspace=='operational'))==0

def test_csv_atomic_commit_and_missing_value(client,tmp_path):
    c,Session=client;header=setup_import(Session,tmp_path)
    raw=(header+'maitri,ENV,temperature,,degC,2026-01-01T05:30:00+05:30\n'+'maitri,ENV,temperature,-8,degC,2026-01-02T00:00:00Z\n').encode()
    with Session() as db:
        b=preview(db,'operational','maitri','test',raw,'Uploaded log','Log reference','observation');db.commit();assert not b.errors
        commit_import(db,'operational','maitri','test',b.id);db.commit();commit_import(db,'operational','maitri','test',b.id);db.commit()
        rows=list(db.scalars(select(Measurement).where(Measurement.workspace=='operational').order_by(Measurement.observed_at)))
        assert len(rows)==2 and rows[0].value is None and rows[0].quality=='missing'
        assert rows[0].observed_at=='2026-01-01T00:00:00+00:00'
        assert all(m.verification=='unverified' for m in rows)

def test_duplicate_import_race_rolls_back(client,tmp_path):
    c,Session=client;header=setup_import(Session,tmp_path)
    raw=(header+'maitri,ENV,temperature,-4,degC,2026-01-01T00:00:00Z\n'+'maitri,ENV,temperature,-8,degC,2026-01-02T00:00:00Z\n').encode()
    with Session() as db:
        a=preview(db,'operational','maitri','test',raw,'Batch one','Log reference','observation');b=preview(db,'operational','maitri','test',raw,'Batch two','Log reference','observation');db.commit();commit_import(db,'operational','maitri','test',a.id);db.commit()
        with pytest.raises(HTTPException):commit_import(db,'operational','maitri','test',b.id)
        db.rollback();assert db.scalar(select(func.count()).select_from(Measurement).where(Measurement.workspace=='operational'))==2
        assert db.get(ImportBatch,b.id).status=='preview'

def test_alert_hysteresis_late_data_dedup(client):
    c,Session=client;base,h=private(c);d=c.get(base+'/snapshot',headers=h).json();a=d['alerts'][0];m=next(x for x in d['measurements'] if x['id']==a['measurement_id'])
    def send(value,t):return c.post(base+'/measurements',headers=h,json={k:m[k] for k in ['asset_id','source_id','metric','unit']}|{'value':value,'observed_at':t})
    assert send(94,'2026-09-06T02:00:00Z').status_code==200
    assert len(c.get(base+'/snapshot',headers=h).json()['alerts'])==1
    send(87,'2026-09-06T03:00:00Z');assert c.get(base+'/snapshot',headers=h).json()['alerts'][0]['recovered'] is False
    send(82,'2026-09-06T04:00:00Z');assert c.get(base+'/snapshot',headers=h).json()['alerts'][0]['recovered'] is True
    send(100,'2026-09-06T01:00:00Z');assert len(c.get(base+'/snapshot',headers=h).json()['alerts'])==1
    send(94,'2026-09-06T05:00:00Z');send(94,'2026-09-06T06:00:00Z')
    assert len(c.get(base+'/snapshot',headers=h).json()['alerts'])==2

def test_scenarios_repeatable_without_mutations(client):
    c,Session=client;base,h=private(c);before=c.get(base+'/snapshot',headers=h).json();v={'failure':'generator','backup_kw':100,'delay_days':60}
    result=c.post(base+'/scenarios',headers=h,json=v);assert result.status_code==200 and result.json()['deficit_kw']>0
    after=c.get(base+'/snapshot',headers=h).json()
    for key in ['measurements','inventory','alerts','work_orders','audit']:assert before[key]==after[key]
    assert c.post(base+'/scenarios',headers=h,json=v).json()==result.json()

def test_fuel_is_shared_with_energy(client):
    c,Session=client;base,h=private(c);d=c.get(base+'/snapshot',headers=h).json();fuel=next(i for i in d['inventory'] if i['name']=='Polar diesel')
    c.post(base+'/inventory/transactions',headers=h,json={'item_id':fuel['id'],'delta':-100,'kind':'issue','reason':'Fuel consumption entry','idempotency_key':'fuel-entry-1'})
    e=c.get(base+'/energy',headers=h).json();assert e['fuel_litres']==fuel['quantity']-100
    assert round(e['fuel_litres']/e['fuel_burn_l_day'],2)==e['autonomy_days']

def test_seed_preserves_saved_edits(client):
    c,Session=client
    with Session() as db:
        i=db.scalar(select(Inventory).where(Inventory.workspace=='demo'));i.quantity=123;db.commit();id=i.id
        initialize(db);assert db.get(Inventory,id).quantity==123

def test_restart_migration_and_sqlite_backup_restore(tmp_path):
    dbfile=tmp_path/'persistent.db';env=os.environ|{'DATABASE_URL':'sqlite:///'+str(dbfile)}
    subprocess.run([sys.executable,'-m','alembic','upgrade','0001'],env=env,check=True,capture_output=True)
    db=sqlite3.connect(dbfile);db.execute("INSERT INTO workspaces(id,kind,created_at) VALUES('saved','test','2026-09-07')")
    db.execute("INSERT INTO work_orders(id,workspace,station,alert_id,asset_id,title,assignee,priority,due_date,status,diagnosis,resolution,created_at) VALUES('saved-order','saved','maitri','alert-ref','asset-ref','Saved inspection','Engineer','high','2026-09-08','resolved','Unconfirmed','Inspection retained across additive migration','2026-09-07')");db.commit()
    backup=sqlite3.connect(tmp_path/'backup.db');db.backup(backup);backup.close();db.close()
    subprocess.run([sys.executable,'-m','alembic','upgrade','head'],env=env,check=True,capture_output=True)
    with sqlite3.connect(dbfile) as db:
        assert db.execute("SELECT kind FROM workspaces WHERE id='saved'").fetchone()==('test',)
        assert db.execute("SELECT resolution FROM work_orders WHERE id='saved-order'").fetchone()==('Inspection retained across additive migration',)
        assert db.execute("SELECT COUNT(*) FROM reservations").fetchone()==(0,)
    with sqlite3.connect(tmp_path/'backup.db') as restored:assert restored.execute("SELECT kind FROM workspaces WHERE id='saved'").fetchone()==('test',)

@pytest.mark.skipif(not os.getenv('TEST_POSTGRES_URL'),reason='No PostgreSQL test server; use a disposable TEST_POSTGRES_URL database')
def test_postgres_concurrent_inventory():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend.seed import seed_workspace
    engine=create_engine(os.environ['TEST_POSTGRES_URL']);Base.metadata.create_all(engine);Session=sessionmaker(engine,expire_on_commit=False);w='session-'+uid()
    with Session() as db:seed_workspace(db,w,'session');db.commit();item=db.scalar(select(Inventory).where(Inventory.workspace==w,Inventory.station=='maitri',Inventory.name=='Coolant filter'));id=item.id
    def issue(i):
        try:
            with Session() as db:r=transact(db,w,'maitri','test',{'item_id':id,'delta':-2,'kind':'issue','reason':'Postgres contention test','work_order_id':None,'idempotency_key':'postgres-'+str(i)});db.commit();return r.balance
        except HTTPException as e:return e.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:assert sorted(pool.map(issue,[1,2]))==[1,409]
    engine.dispose()

def test_backup_helper_restores_originals_without_overwrite(tmp_path):
    db=tmp_path/'original.db'
    with sqlite3.connect(db) as c:c.execute('CREATE TABLE saved(value TEXT)');c.execute("INSERT INTO saved VALUES('retained')");c.commit()
    storage=tmp_path/'source';storage.mkdir();(storage/'sample.csv').write_bytes(b'original provider bytes\n')
    backup=tmp_path/'backup';restored=tmp_path/'restore.db';files=tmp_path/'restored-files'
    command=[sys.executable,'scripts/backup.py']
    subprocess.run(command+['backup','--database',str(db),'--storage',str(storage),'--destination',str(backup)],check=True,capture_output=True)
    subprocess.run(command+['restore','--database',str(restored),'--storage',str(files),'--destination',str(backup)],check=True,capture_output=True)
    assert (files/'sample.csv').read_bytes()==(storage/'sample.csv').read_bytes()
    with sqlite3.connect(restored) as c:assert c.execute('SELECT value FROM saved').fetchone()==('retained',)
    again=subprocess.run(command+['restore','--database',str(restored),'--storage',str(files),'--destination',str(backup)],capture_output=True)
    assert again.returncode!=0
