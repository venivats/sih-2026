from backend.tests.test_workflow import client, private
from backend.tests.test_acceptance import admin

def test_exercises_are_private_atomic_repeatable_and_recover_separately(client):
    c,Session=client
    a,ha=private(c);b,hb=private(c)
    payload={'preset':'overheat','idempotency_key':'training-event-001'}
    assert c.post('/api/w/demo/maitri/exercises',json=payload).status_code==403
    assert c.post('/api/w/operational/maitri/exercises',headers=admin(Session),json=payload).status_code==403
    assert c.post(a+'/exercises',headers=hb,json=payload).status_code==403
    before=c.get(a+'/snapshot',headers=ha).json()
    first=c.post(a+'/exercises',headers=ha,json=payload);assert first.status_code==200,first.text
    repeat=c.post(a+'/exercises',headers=ha,json=payload);assert repeat.json()==first.json()
    after=c.get(a+'/snapshot',headers=ha).json()
    assert len(after['measurements'])==len(before['measurements'])+2
    assert len(after['alerts'])==len(before['alerts']) # existing incident deduplicates
    assert after['inventory']==before['inventory']
    assert len(c.get(b+'/snapshot',headers=hb).json()['measurements'])==len(before['measurements'])
    assert c.post(a+'/exercises',headers=ha,json=payload|{'preset':'recovery'}).status_code==409
    recover=c.post(a+'/exercises',headers=ha,json={'preset':'recovery','idempotency_key':'recovery-event-001'})
    assert recover.status_code==200
    assert c.get(a+'/snapshot',headers=ha).json()['alerts'][0]['recovered']
    fresh=c.post(a+'/exercises',headers=ha,json=payload|{'idempotency_key':'training-event-002'})
    assert fresh.status_code==200
    final=c.get(a+'/snapshot',headers=ha).json()
    assert len(final['alerts'])==2 and final['work_orders']==before['work_orders']
    assert final['audit'][-1]['action']=='exercise_completed'

def test_waste_custody_evidence_idempotency_and_scope(client):
    c,Session=client;a,h=private(c);b,hb=private(c)
    snap=c.get(a+'/snapshot',headers=h).json()
    payload={'category':'empty_fuel_drums','quantity':3,'unit':'each','location':'Demo storage','destination':'Return port assumption','shipment_id':snap['shipments'][0]['id'],'evidence':'Simulated collection record; authenticity not claimed.','idempotency_key':'waste-record-001'}
    assert c.post('/api/w/demo/maitri/waste',json=payload).status_code==403
    assert c.post(a+'/waste',headers=h,json=payload|{'quantity':2.5}).status_code==422
    result=c.post(a+'/waste',headers=h,json=payload);assert result.status_code==200,result.text
    item=result.json();assert item['origin']=='simulation'
    assert c.post(a+'/waste',headers=h,json=payload).json()['id']==item['id']
    assert c.post(a+'/waste',headers=h,json=payload|{'quantity':4}).status_code==409
    route=a+'/waste/'+item['id']
    assert c.patch(route,headers=h,json={'status':'returned','note':'Premature return assertion'}).status_code==409
    assert c.patch(b+'/waste/'+item['id'],headers=hb,json={'status':'packed','note':'Cannot cross workspace'}).status_code==404
    for status in ['packed','loaded','returned']:
        response=c.patch(route,headers=h,json={'status':status,'note':'Demonstration custody reference for '+status})
        assert response.status_code==200,response.text
    final=c.get(a+'/snapshot',headers=h).json()
    assert [v['status'] for v in final['waste'][0]['history']]==['collected','packed','loaded','returned']
    assert final['inventory']==snap['inventory']
    assert c.get(b+'/snapshot',headers=hb).json()['waste']==[]
    assert c.get('/api/w/operational/maitri/snapshot',headers=admin(Session)).json()['waste']==[]
