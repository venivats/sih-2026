from ..models import Asset
from ..common import scoped
from .energy import energy
from .assets import impact

def run(db,w,s,inputs):
    baseline=energy(db,w,s)
    load=baseline['consumption_kw'];generation=baseline['generation_kw'];burn=baseline['fuel_burn_l_day'];fuel=baseline['fuel_litres']
    if any(x is None for x in [load,generation,burn,fuel]):
        return {'available':False,'reason':'Baseline inputs are unavailable. Import appropriate resource and power records first.','baseline':baseline,'inputs':inputs}
    factor=1+inputs['demand_increase']/100
    if inputs['failure']=='weather': factor+=.15
    demand=max(0,load*factor-inputs['shed_kw'])
    supply=inputs['backup_kw'] if inputs['failure']=='generator' else generation
    required_burn=burn*demand/load if load else None
    days=fuel/required_burn if required_burn else None
    code={'generator':'GEN-A','communications':'COMMS','heating':'HVAC','weather':'HVAC'}.get(inputs['failure'])
    a=db.scalar(scoped(db,Asset,w,s).where(Asset.code==code)) if code else None
    dependencies=impact(db,w,s,a.id) if a else None
    return {'available':True,'model_version':'linear-resource-v1','inputs':inputs,'baseline':baseline,'demand_kw':round(demand,2),'supply_kw':supply,'deficit_kw':round(max(0,demand-supply),2),'autonomy_days':round(days,2) if days is not None else None,'delay_reserve_litres':round(fuel-required_burn*inputs['delay_days'],2) if required_burn is not None else None,'dependencies':dependencies,'lineage':baseline['lineage'],'assumptions':['Deterministic illustration; not a scientifically validated forecast.','Fuel burn scales linearly with requested load; generator efficiency and dispatch are not modelled.','Backup capacity is a user assumption; transfer success and start delay are not guaranteed.','Weather option assumes 15% extra demand. Heating and communications effects use graph reachability, not physical models.','Delay reserve is stock remaining after the entered horizon starting at the baseline; shipment arrival is not predicted.'],'actions':['Inspect affected dependencies and confirm backup readiness.','Protect essential loads before selecting discretionary load shedding.','Request replenishment if the delay horizon exceeds estimated autonomy.']}
