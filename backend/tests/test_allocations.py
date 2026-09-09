from test_workflow import client,private

def test_reserved_stock_is_protected_consumed_and_released(client):
    c,_=client;base,h=private(c)
    snap=c.get(base+'/snapshot',headers=h).json()
    a=snap['alerts'][0]['id'];item=next(i for i in snap['inventory'] if i['name']=='Coolant filter')
    c.post(base+'/alerts/'+a+'/acknowledge',headers=h)
    order=c.post(base+'/alerts/'+a+'/work-orders',headers=h,json={'assignee':'Engineer','due_date':'2026-09-08'}).json()['id']
    payload={'item_id':item['id'],'work_order_id':order,'quantity':2,'idempotency_key':'reserve-example'}
    r=c.post(base+'/reservations',headers=h,json=payload);assert r.status_code==200,r.text
    assert c.post(base+'/reservations',headers=h,json=payload).json()['id']==r.json()['id']
    issue={'item_id':item['id'],'delta':-2,'kind':'issue','reason':'Unrelated issue','idempotency_key':'other-issue'}
    assert c.post(base+'/inventory/transactions',headers=h,json=issue).status_code==409
    assert c.patch(base+'/work-orders/'+order,headers=h,json={'status':'in_progress'}).status_code==200
    resolution={'status':'resolved','notes':'Verified example repair and inspection.'}
    assert c.patch(base+'/work-orders/'+order,headers=h,json=resolution).status_code==409
    use=issue|{'delta':-1,'kind':'spare_use','work_order_id':order,'idempotency_key':'spare-consumed'}
    assert c.post(base+'/inventory/transactions',headers=h,json=use).status_code==200
    snap=c.get(base+'/snapshot',headers=h).json();assert snap['reservations'][0]['remaining']==1
    assert next(i for i in snap['inventory'] if i['id']==item['id'])['quantity']==2
    assert c.post(base+'/reservations/'+r.json()['id']+'/release',headers=h).status_code==200
    assert c.patch(base+'/work-orders/'+order,headers=h,json=resolution).status_code==200
    assert c.get(base+'/snapshot',headers=h).json()['alerts'][0]['recovered'] is False
