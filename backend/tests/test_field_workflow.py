from datetime import datetime, timezone, timedelta
from backend.tests.test_workflow import client, private
from backend.tests.test_operations import crew_payload
from backend.tests.test_acceptance import admin


def setup_field(c, base, headers):
    crew = c.post(base+'/operations', headers=headers, json=crew_payload()).json()
    asset = c.get(base+'/snapshot', headers=headers).json()['assets'][0]
    payload = {'kind':'field_plan','label':'Fictional field assignment','idempotency_key':'field-plan-001','data':{
        'crew_id':crew['id'],'asset_id':asset['id'],'centre_x':200,'centre_y':0,'radius_m':160,
        'restricted_x':390,'restricted_y':70,'restricted_radius_m':65,'check_in_due':'2026-12-01T00:00:00Z',
        'note':'Illustrative local offsets; no real tracking connected.'}}
    result = c.post(base+'/operations', headers=headers, json=payload)
    assert result.status_code == 200, result.text
    return crew, result.json(), payload


def test_field_evidence_scope_idempotency_immutability_and_time(client):
    c,_=client; a,h=private(c); b,hb=private(c)
    crew,plan,body=setup_field(c,a,h)
    assert c.post(a+'/operations',headers=h,json=body).json()['id']==plan['id']
    _,foreign,_=setup_field(c,b,hb)
    position={'kind':'field_position','label':'Simulated tracker','idempotency_key':'position-001','data':{
        'crew_id':crew['id'],'plan_id':plan['id'],'x':180,'y':0,'accuracy_m':12,
        'observed_at':datetime.now(timezone.utc).isoformat(),'device_id':'simulated-C03'}}
    for patch,expected in [({'accuracy_m':-1},422),({'observed_at':'2026-09-25T12:00:00'},422),
                           ({'observed_at':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()},422),
                           ({'plan_id':foreign['id']},404)]:
        r=c.post(a+'/operations',headers=h,json=position|{'data':position['data']|patch})
        assert r.status_code==expected,r.text
    result=c.post(a+'/operations',headers=h,json=position);assert result.status_code==200,result.text
    point=result.json()
    assert c.post(a+'/operations',headers=h,json=position).json()['id']==point['id']
    assert c.post(a+'/operations',headers=h,json=position|{'data':position['data']|{'x':999}}).status_code==409
    assert c.patch(a+'/operations/'+point['id'],headers=h,json={'version':0,'data':position['data']}).status_code==409
    event={'kind':'field_event','label':'Contact received','idempotency_key':'field-event-001','data':{
        'crew_id':crew['id'],'plan_id':plan['id'],'position_id':point['id'],'event':'inspection',
        'note':'Inspected the fictional installation. Sensor recovery remains separate.'}}
    r=c.post(a+'/operations',headers=h,json=event);assert r.status_code==200,r.text
    assert c.patch(a+'/operations/'+r.json()['id'],headers=h,json={'version':0,'data':event['data']}).status_code==409
    assert c.post(a+'/operations',headers=hb,json=event).status_code==403
    assert c.get(b+'/snapshot',headers=hb).json()['operations'][-1]['id']!=point['id']
    updated={'version':0,'data':plan['data']|{'radius_m':140}}
    assert c.patch(a+'/operations/'+plan['id'],headers=h,json=updated).status_code==200
    assert c.patch(a+'/operations/'+plan['id'],headers=h,json=updated).status_code==409
    checkin=event|{'idempotency_key':'check-in-001','data':event['data']|{'event':'check_in','check_in_due':plan['data']['check_in_due']}}
    assert c.post(a+'/operations',headers=h,json=checkin).status_code==200
    wrong=checkin|{'idempotency_key':'check-in-002','data':checkin['data']|{'check_in_due':'2026-11-30T00:00:00Z'}}
    assert c.post(a+'/operations',headers=h,json=wrong).status_code==409


def test_operational_workspace_rejects_unsurveyed_tracking(client):
    c,Session=client;h=admin(Session);base='/api/w/operational/maitri'
    crew=c.post(base+'/operations',headers=h,json=crew_payload()).json()
    asset={'id':'unvalidated-asset'}
    payload={'kind':'field_plan','label':'Unvalidated field geometry','idempotency_key':'operational-plan-001','data':{
        'crew_id':crew['id'],'asset_id':asset['id'],'centre_x':0,'centre_y':0,'radius_m':100,
        'restricted_x':390,'restricted_y':70,'restricted_radius_m':65,'check_in_due':'2026-12-01T00:00:00Z',
        'note':'Unsourced local map must not enter operational tracking.'}}
    r=c.post(base+'/operations',headers=h,json=payload)
    assert r.status_code==422,r.text
    assert 'simulation-only' in r.text


def test_comparison_preserves_scope_and_rejects_overwrite(client):
    c,_=client;base,h=private(c);d=c.get(base+'/snapshot',headers=h).json()
    data={'snapshot':{'workspace':d['workspace'],'station':d['station'],'inputs':{'inventory':d['inventory']}},
          'daily_burn':650,'delay_days':3,'reserve_litres':500,'note':'Constant burn assumption; review load priorities before use.'}
    payload={'kind':'comparison','label':'Reduced demand option','idempotency_key':'comparison-001','data':data}
    r=c.post(base+'/operations',headers=h,json=payload);assert r.status_code==200,r.text
    assert c.post(base+'/operations',headers=h,json=payload).json()['id']==r.json()['id']
    assert c.patch(base+'/operations/'+r.json()['id'],headers=h,json={'version':0,'data':data}).status_code==409
    wrong=data|{'snapshot':data['snapshot']|{'station':'bharati'}}
    assert c.post(base+'/operations',headers=h,json=payload|{'data':wrong,'idempotency_key':'comparison-002'}).status_code==422
    assert c.get(base+'/snapshot',headers=h).json()['inventory']==d['inventory']
