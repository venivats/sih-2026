import math
from datetime import datetime,timezone
from fastapi import HTTPException
from ..models import Measurement,Rule,Alert,Asset,Source
from ..common import scoped,record,audit

UNITS={'temperature':'degC','coolant_temperature':'degC','generation':'kW','consumption':'kW','soc':'%','fuel_burn':'L/day','wind_speed':'m/s','pressure':'hPa','humidity':'%'}
def timestamp(value):
    try:
        dt=datetime.fromisoformat(value.replace('Z','+00:00'))
        if dt.tzinfo is None: raise ValueError('timezone required')
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError: raise ValueError('Use an ISO 8601 timestamp with timezone')

def ingest(db,w,s,data,actor,evaluate=True):
    asset=record(db,Asset,data['asset_id'],w,s,lock=True)
    source=record(db,Source,data['source_id'],w,s)
    metric=data['metric']
    if metric not in UNITS or data['unit']!=UNITS[metric]: raise HTTPException(422,'Unknown metric or incompatible unit')
    value=data['value']
    if value is not None and not math.isfinite(value): raise HTTPException(422,'Value must be finite or null')
    if w=='operational' and source.origin=='simulation': raise HTTPException(422,'Simulation cannot enter operational telemetry')
    try: observed=timestamp(data['observed_at'])
    except ValueError as e: raise HTTPException(422,str(e))
    existing=db.scalar(scoped(db,Measurement,w,s).where(Measurement.asset_id==asset.id,Measurement.metric==metric,Measurement.observed_at==observed))
    if existing: raise HTTPException(409,'Measurement already exists at this timestamp')
    m=Measurement(workspace=w,station=s,asset_id=asset.id,metric=metric,value=value,unit=data['unit'],observed_at=observed,source_id=source.id,origin=source.origin,verification=source.verification,quality='missing' if value is None else data.get('quality','unchecked'),lineage=[source.id])
    db.add(m);db.flush()
    if evaluate:
        for rule in db.scalars(scoped(db,Rule,w,s).where(Rule.asset_id==asset.id,Rule.metric==metric).with_for_update()):
            if rule.last_observed and observed<=rule.last_observed: continue
            rule.last_observed=observed
            if value is None: rule.streak=0;continue
            rule.streak=rule.streak+1 if value>rule.threshold else 0
            if rule.active_alert and value<=rule.recovery_threshold:
                a=record(db,Alert,rule.active_alert,w,s);a.recovered=True;a.recovered_at=observed
                audit(db,w,s,actor,'sensor_recovered',a.id,{'measurement_id':m.id})
                rule.active_alert=None
            if not rule.active_alert and rule.streak>=rule.debounce:
                a=Alert(workspace=w,station=s,asset_id=asset.id,rule_id=rule.id,measurement_id=m.id,title=f'{asset.name}: {metric.replace("_"," ")} above {rule.threshold:g} {m.unit}')
                db.add(a);db.flush();rule.active_alert=a.id
                audit(db,w,s,actor,'alert_opened',a.id,{'measurement_id':m.id,'assumption':rule.assumption})
    return m
