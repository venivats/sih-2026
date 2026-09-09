from backend.tests.test_workflow import client, private
from backend.tests.test_acceptance import admin
from backend.models import OpsRecord


def crew_payload(key='crew-record-001'):
    return {'kind':'crew','label':'Fictional engineer','idempotency_key':key,'data':{
        'role':'Station engineer','status':'on_duty','shift_start':'2026-09-06T00:00:00Z',
        'shift_end':'2026-12-01T00:00:00Z'}}


def test_roster_permissions_idempotency_scope_and_versions(client):
    c,Session=client;a,h=private(c);b,hb=private(c);payload=crew_payload()
    assert c.post('/api/w/demo/maitri/operations',json=payload).status_code==403
    assert c.post(a+'/operations',headers=hb,json=payload).status_code==403
    assert c.post(a+'/operations',headers=h,json=payload|{'data':payload['data']|{'shift_end':'2026-09-05T00:00:00Z'}}).status_code==422
    assert c.post(a+'/operations',headers=h,json=payload|{'data':payload['data']|{'shift_start':'2026-09-06T00:00:00'}}).status_code==422
    first=c.post(a+'/operations',headers=h,json=payload);assert first.status_code==200,first.text
    row=first.json();assert row['origin']=='simulation'
    assert c.post(a+'/operations',headers=h,json=payload).json()['id']==row['id']
    assert c.post(a+'/operations',headers=h,json=payload|{'label':'Different person'}).status_code==409
    change={'version':0,'data':payload['data']|{'status':'off_duty'}}
    route=a+'/operations/'+row['id']
    assert c.patch(b+'/operations/'+row['id'],headers=hb,json=change).status_code==404
    assert c.patch(route.replace('/maitri/','/bharati/'),headers=h,json=change).status_code==404
    changed=c.patch(route,headers=h,json=change);assert changed.status_code==200,changed.text
    assert changed.json()['version']==1
    assert c.patch(route,headers=h,json=change).status_code==409
    with Session() as db:assert db.get(OpsRecord,row['id']).data['status']=='off_duty'
    assert c.get(b+'/snapshot',headers=hb).json()['operations']==[]
    assert c.get('/api/w/operational/maitri/snapshot',headers=admin(Session)).json()['operations']==[]


def test_linked_tasks_contacts_and_research_reject_cross_workspace_records(client):
    c,_=client;a,h=private(c);b,hb=private(c)
    crew=c.post(a+'/operations',headers=h,json=crew_payload()).json()
    foreign=c.post(b+'/operations',headers=hb,json=crew_payload()).json()
    d=c.get(a+'/snapshot',headers=h).json()
    task={'kind':'outdoor_task','label':'Inspect fuel storage','idempotency_key':'outdoor-task-001','data':{
        'assignee_id':crew['id'],'shipment_id':d['shipments'][0]['id'],'status':'planned','wind_limit_ms':20,
        'scheduled_at':'2026-09-06T00:00:00Z','note':'Fictional threshold for training review'}}
    assert c.post(a+'/operations',headers=h,json=task|{'data':task['data']|{'assignee_id':foreign['id']}}).status_code==404
    assert c.post(a+'/operations',headers=h,json=task|{'data':task['data']|{'wind_limit_ms':-1}}).status_code==422
    assert c.post(a+'/operations',headers=h,json=task).status_code==200
    contact={'kind':'contact','label':'Operations briefing','idempotency_key':'contact-record-001','data':{
        'assignee_id':crew['id'],'starts_at':'2026-09-06T01:00:00Z','ends_at':'2026-09-06T00:00:00Z',
        'status':'planned','note':'Planned human contact, no orbital calculation'}}
    assert c.post(a+'/operations',headers=h,json=contact).status_code==422
    contact['data']['ends_at']='2026-09-06T02:00:00Z'
    assert c.post(a+'/operations',headers=h,json=contact).status_code==200
    research={'kind':'research','label':'Demo sample freezer','idempotency_key':'research-record-001','data':{
        'asset_id':d['assets'][0]['id'],'owner_id':crew['id'],'interruption_hours':2,'note':'Assumed tolerance, not validated laboratory guidance'}}
    assert c.post(a+'/operations',headers=h,json=research).status_code==200
    foreign_asset=c.get(b+'/snapshot',headers=hb).json()['assets'][0]['id']
    assert c.post(a+'/operations',headers=h,json=research|{'data':research['data']|{'asset_id':foreign_asset}}).status_code==404
    final=c.get(a+'/snapshot',headers=h).json()
    for key in ['measurements','inventory','shipments','alerts']:assert final[key]==d[key]


def test_crew_assignment_respects_duty_and_keeps_recovery_separate(client):
    c,_=client;a,h=private(c);crew=c.post(a+'/operations',headers=h,json=crew_payload()).json()
    alert=c.get(a+'/snapshot',headers=h).json()['alerts'][0]
    c.post(a+'/alerts/'+alert['id']+'/acknowledge',headers=h)
    order=c.post(a+'/alerts/'+alert['id']+'/work-orders',headers=h,json={'assignee':'Unassigned','due_date':'2026-09-08'}).json()
    route=a+'/work-orders/'+order['id']+'/assign-crew';body={'crew_id':crew['id'],'notes':'Duty period reviewed for this assignment'}
    assigned=c.post(route,headers=h,json=body);assert assigned.status_code==200,assigned.text
    assert assigned.json()['assignee']==crew['label']
    change={'version':0,'data':crew['data']|{'status':'off_duty'}}
    c.patch(a+'/operations/'+crew['id'],headers=h,json=change)
    assert c.post(route,headers=h,json=body).status_code==409
    change={'version':1,'data':crew['data']|{'shift_end':'2026-09-07T00:00:00Z'}}
    c.patch(a+'/operations/'+crew['id'],headers=h,json=change)
    assert c.post(route,headers=h,json=body).status_code==409
    assert c.get(a+'/snapshot',headers=h).json()['alerts'][0]['recovered'] is False


def test_handover_is_immutable_and_scope_checked(client):
    c,Session=client;a,h=private(c);d=c.get(a+'/snapshot',headers=h).json()
    payload={'kind':'handover','label':'Reviewed shift handover','idempotency_key':'handover-record-001','data':{
        'text':'Historical demonstration. Fuel inventory and assumptions retained for review.',
        'model_version':'handover-v1','snapshot':{'workspace':d['workspace'],'station':'maitri','fuel_litres':28400}}}
    wrong=payload|{'data':payload['data']|{'snapshot':{'workspace':'operational','station':'maitri'}}}
    assert c.post(a+'/operations',headers=h,json=wrong).status_code==422
    first=c.post(a+'/operations',headers=h,json=payload);assert first.status_code==200,first.text
    row=first.json()
    assert c.post(a+'/operations',headers=h,json=payload).json()['id']==row['id']
    assert c.patch(a+'/operations/'+row['id'],headers=h,json={'version':0,'data':payload['data']}).status_code==409
    with Session() as db:assert db.get(OpsRecord,row['id']).data==payload['data']
