import os
os.environ['APP_ENV']='test'
os.environ['JWT_SECRET']='test-only-'+('x'*50)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base,db_session
from backend.main import app
from backend.seed import initialize
import pytest

@pytest.fixture
def client(tmp_path):
    engine=create_engine('sqlite:///'+str(tmp_path/'test.db'),connect_args={'check_same_thread':False,'timeout':30})
    Base.metadata.create_all(engine);Session=sessionmaker(engine,expire_on_commit=False)
    with Session() as db: initialize(db)
    def override():
        with Session() as db:
            try: yield db;db.commit()
            except Exception: db.rollback();raise
    app.dependency_overrides[db_session]=override
    with TestClient(app) as c: yield c,Session
    app.dependency_overrides.clear();engine.dispose()

def private(c):
    r=c.post('/api/demo-sessions');assert r.status_code==200,r.text
    d=r.json();return '/api/w/'+d['workspace']+'/maitri',{'Authorization':'Bearer '+d['access_token']}

def test_complete_persisted_workflow(client):
    c,Session=client;base,h=private(c)
    snap=c.get(base+'/snapshot',headers=h).json();alert=snap['alerts'][0]
    assert c.post(base+'/alerts/'+alert['id']+'/work-orders',headers=h,json={'assignee':'Engineer','due_date':'2026-09-08'}).status_code==409
    assert c.post(base+'/alerts/'+alert['id']+'/acknowledge',headers=h).status_code==200
    r=c.post(base+'/alerts/'+alert['id']+'/work-orders',headers=h,json={'assignee':'Engineer','due_date':'2026-09-08'});assert r.status_code==200,r.text
    order=r.json()
    assert c.patch(base+'/work-orders/'+order['id'],headers=h,json={'status':'in_progress'}).status_code==200
    assert c.patch(base+'/work-orders/'+order['id'],headers=h,json={'status':'resolved','notes':'Filter inspected and replaced in demonstration.'}).status_code==200
    snap=c.get(base+'/snapshot',headers=h).json()
    assert snap['work_orders'][0]['status']=='resolved'
    assert snap['alerts'][0]['recovered'] is False
    from backend.models import WorkOrder
    with Session() as db: assert db.get(WorkOrder,order['id']).resolution.startswith('Filter')
