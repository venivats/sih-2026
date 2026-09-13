from fastapi.testclient import TestClient
from sqlalchemy import select
from backend.tests.test_workflow import client,private
from backend.modules.events import revision
from backend.models import WorkOrder

def test_two_clients_observe_committed_work_and_scoped_revisions(client):
    c,Session=client;base,h=private(c);workspace=base.split('/')[3]
    other,other_h=private(c)
    with Session() as db:
        before=revision(db,workspace,'maitri');isolated=revision(db,other.split('/')[3],'maitri')
    with TestClient(c.app) as second:
        alert=c.get(base+'/snapshot',headers=h).json()['alerts'][0]
        assert second.post(base+'/alerts/'+alert['id']+'/acknowledge',headers=h).status_code==200
        order=second.post(base+'/alerts/'+alert['id']+'/work-orders',headers=h,json={'assignee':'Test engineer','due_date':'2026-09-12'}).json()
        assert c.get(base+'/snapshot',headers=h).json()['work_orders'][0]['id']==order['id']
        assert c.get(other+'/snapshot',headers=h).status_code==403
    with Session() as db:
        assert revision(db,workspace,'maitri')!=before
        assert revision(db,other.split('/')[3],'maitri')==isolated
        assert db.get(WorkOrder,order['id']).assignee=='Test engineer'

def test_vercel_fails_closed_without_external_persistence(monkeypatch):
    import importlib
    monkeypatch.setenv('VERCEL','1');monkeypatch.delenv('DATABASE_URL',raising=False);monkeypatch.delenv('S3_BUCKET',raising=False)
    import api.index as entry
    importlib.reload(entry)
    with TestClient(entry.app) as c:
        for endpoint in ['/api/health','/api/w/operational/maitri/snapshot']:
            r=c.get(endpoint);assert r.status_code==503;assert r.json()['status']=='configuration_required'
        assert c.post('/api/demo-sessions').status_code==503
    from backend.modules.storage import put_bytes
    import pytest
    with pytest.raises(RuntimeError):put_bytes('operational',b'never ephemeral')

def test_project_roles_limit_consequential_changes(client):
    from backend.modules.access import token,passwords
    from backend.models import User
    from backend.modules.permissions import ROLE_AREAS
    c,Session=client
    headers={}
    with Session() as db:
        for role in ['scientist','logistics_coordinator','maintenance_engineer','station_lead']:
            u=User(username='test-'+role,password_hash=passwords.hash('test-password-123'),role=role);db.add(u);db.flush();headers[role]={'Authorization':'Bearer '+token(u.id,role)}
        db.commit()
    body={'kind':'crew','label':'Fictional test crew','idempotency_key':'crew-role-test','data':{'role':'Test duty','status':'on_duty','shift_start':'2026-09-10T00:00:00Z','shift_end':'2026-09-12T00:00:00Z'}}
    base='/api/w/operational/maitri'
    assert c.post(base+'/operations',headers=headers['scientist'],json=body).status_code==403
    assert c.post(base+'/operations',headers=headers['maintenance_engineer'],json=body).status_code==403
    assert c.post(base+'/operations',headers=headers['logistics_coordinator'],json=body).status_code==200
    assert c.post(base+'/official-weather/refresh',headers=headers['station_lead']).status_code==403
    assert c.post(base+'/inventory/transactions',headers=headers['scientist'],json={'item_id':'no-item','delta':1,'kind':'receipt','reason':'test receipt','idempotency_key':'role-receipt-test'}).status_code==403
    assert c.get(base+'/snapshot',headers=headers['scientist']).status_code==200
    assert c.get('/api/auth/me',headers=headers['scientist']).json()['write_areas']==['handover','research']

def test_distinct_accounts_share_saved_changes_and_reject_stale_edits(client):
    """Authenticate two actual users; check identity, conflicts and stream revisions."""
    import asyncio
    from backend.modules.access import passwords
    from backend.modules.events import stream_revisions
    from backend.models import User, Audit
    c, Session = client
    with Session() as db:
        for username in ('shift-alpha', 'shift-bravo'):
            db.add(User(username=username, password_hash=passwords.hash('fixture-only-password-123'), role='station_lead'))
        db.commit()
    def login(client, username):
        response = client.post('/api/auth/token', data={'username': username, 'password': 'fixture-only-password-123'})
        assert response.status_code == 200
        return {'Authorization': 'Bearer ' + response.json()['access_token']}
    base = '/api/w/operational/maitri'
    with TestClient(c.app) as second:
        first_h, second_h = login(c, 'shift-alpha'), login(second, 'shift-bravo')
        alpha = c.get('/api/auth/me', headers=first_h).json()['subject']
        bravo = second.get('/api/auth/me', headers=second_h).json()['subject']
        assert alpha != bravo
        body = {'kind':'crew','label':'Fictional shared workflow','idempotency_key':'distinct-users-crew','data':{'role':'Test duty','status':'on_duty','shift_start':'2026-09-10T00:00:00Z','shift_end':'2026-09-14T00:00:00Z'}}
        response = c.post(base+'/operations', headers=first_h, json=body)
        assert response.status_code == 200
        crew = response.json()
        observed = second.get(base+'/snapshot', headers=second_h).json()
        assert next(x for x in observed['operations'] if x['id']==crew['id'])['version'] == crew['version']
        async def check_stream():
            async def connected(): return False
            stream = stream_revisions(Session, 'operational', 'maitri', connected)
            initial = await anext(stream)
            assert initial.startswith('event: refresh\n')
            update = {'version':crew['version'], 'data':body['data'] | {'status':'off_duty'}}
            assert second.patch(base+'/operations/'+crew['id'], headers=second_h, json=update).status_code == 200
            changed = await anext(stream)
            assert changed.startswith('event: refresh\n') and changed != initial
            # A reconnect always sends the latest revision, even with no subsequent write.
            resumed = stream_revisions(Session, 'operational', 'maitri', connected)
            assert (await anext(resumed)).startswith('event: refresh\n')
            await resumed.aclose(); await stream.aclose()
            assert c.patch(base+'/operations/'+crew['id'], headers=first_h, json=update).status_code == 409
        asyncio.run(check_stream())
        saved = c.get(base+'/snapshot', headers=first_h).json()
        assert next(x for x in saved['operations'] if x['id']==crew['id'])['data']['status'] == 'off_duty'
        with Session() as db:
            events = db.scalars(select(Audit).where(Audit.entity_id==crew['id'])).all()
            assert {x.actor for x in events} == {alpha, bravo}
        # Role changes take effect even for an already-issued token.
        with Session() as db:
            db.get(User, bravo).role = 'viewer'; db.commit()
        assert second.post(base+'/operations', headers=second_h, json=body | {'idempotency_key':'denied-after-role-change'}).status_code == 403
        assert c.get(base+'/snapshot').status_code == 403
