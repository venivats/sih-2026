from ..models import Measurement,Inventory,Asset,Ledger
from ..common import scoped

def energy(db,w,s):
    def latest(metric): return db.scalar(scoped(db,Measurement,w,s).where(Measurement.metric==metric).order_by(Measurement.observed_at.desc()).limit(1))
    gen,load,burn,soc=[latest(x) for x in ['generation','consumption','fuel_burn','soc']]
    fuel=db.scalar(scoped(db,Inventory,w,s).where(Inventory.category=='fuel',Inventory.name=='Polar diesel'))
    battery=db.scalar(scoped(db,Asset,w,s).where(Asset.code=='BAT'))
    def value(x): return x.value if x else None
    balance=gen.value-load.value if gen and load and gen.value is not None and load.value is not None and gen.observed_at==load.observed_at else None
    autonomy=fuel.quantity/burn.value if fuel and burn and burn.value and burn.value>0 else None
    capacity=battery.capacity if battery else None
    reserve=capacity*soc.value/100 if capacity is not None and soc and soc.value is not None else None
    latest_tx=db.scalar(scoped(db,Ledger,w,s).where(Ledger.item_id==fuel.id).order_by(Ledger.created_at.desc()).limit(1)) if fuel else None
    return {'generation_kw':value(gen),'consumption_kw':value(load),'balance_kw':balance,'fuel_litres':fuel.quantity if fuel else None,'fuel_burn_l_day':value(burn),'autonomy_days':round(autonomy,2) if autonomy is not None else None,'soc_percent':value(soc),'reserve_kwh':reserve,'observed_at':gen.observed_at if gen else None,'processing':'derived','lineage':[x.id for x in [gen,load,burn,soc,latest_tx] if x],'sources':list({x.source_id for x in [gen,load,burn,soc,fuel] if x}),'assumptions':['Autonomy = current fuel ledger balance / most recent daily fuel burn. Constant future consumption assumed. Historical burn may be stale.','Battery usable energy = nameplate capacity × state of charge. Losses, degradation and safe discharge limits are excluded.','No subsystem load breakdown is inferred.','Balance requires matching generation and consumption timestamps.'],'formula':'autonomy_days = inventory_litres / fuel_burn_litres_per_day'}
