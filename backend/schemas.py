from typing import Literal
from pydantic import BaseModel,Field,ConfigDict,FiniteFloat
class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid')
class ExerciseIn(Strict):
    preset:Literal['overheat','recovery']
    idempotency_key:str=Field(min_length=8,max_length=100)
class WasteIn(Strict):
    category:Literal['sewage_sludge','solid_waste','incinerator_ash','empty_fuel_drums']
    quantity:FiniteFloat=Field(gt=0,le=1000000)
    unit:Literal['kg','each']
    location:str=Field(min_length=2,max_length=200)
    destination:str=Field(min_length=2,max_length=200)
    shipment_id:str|None=None
    evidence:str=Field(min_length=10,max_length=2000)
    idempotency_key:str=Field(min_length=8,max_length=100)
class WasteTransitionIn(Strict):
    status:Literal['packed','loaded','returned']
    note:str=Field(min_length=10,max_length=1000)
class ReadingIn(Strict):
    asset_id:str
    source_id:str
    metric:str
    value:FiniteFloat|None
    unit:str
    observed_at:str
class OrderIn(Strict):
    assignee:str=Field(min_length=1,max_length=100)
    priority:Literal['low','normal','high','critical']='high'
    due_date:str=Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
class TransitionIn(Strict):
    status:Literal['in_progress','resolved']
    notes:str|None=Field(default=None,max_length=3000)
class LedgerIn(Strict):
    item_id:str
    delta:FiniteFloat
    kind:Literal['receipt','issue','adjustment','spare_use']
    reason:str=Field(min_length=5,max_length=500)
    work_order_id:str|None=None
    idempotency_key:str=Field(min_length=8,max_length=100)
class ReplenishIn(Strict):
    item_id:str
    quantity:FiniteFloat=Field(gt=0)
    idempotency_key:str=Field(min_length=8,max_length=100)
class ReservationIn(ReplenishIn):
    work_order_id:str
class ScenarioIn(Strict):
    failure:Literal['none','generator','communications','heating','weather']='generator'
    demand_increase:FiniteFloat=Field(default=0,ge=0,le=200)
    shed_kw:FiniteFloat=Field(default=0,ge=0,le=500)
    delay_days:FiniteFloat=Field(default=14,ge=0,le=365)
    backup_kw:FiniteFloat=Field(default=180,ge=0,le=1000)
class RuleIn(Strict):
    threshold:FiniteFloat
    recovery_threshold:FiniteFloat
    debounce:int=Field(ge=1,le=20)
    assumption:str=Field(min_length=15,max_length=1000)
class AssetIn(Strict):
    code:str=Field(pattern=r'^[A-Z0-9-]{1,20}$')
    name:str=Field(min_length=2,max_length=100)
    kind:Literal['generator','fuel','distribution','battery','heating','water','communications','load','environment']
class ShipmentIn(Strict):
    status:Literal['planned','dispatched','in_transit','delayed','arrived']
    note:str=Field(min_length=5,max_length=500)
class RuleCreateIn(RuleIn):
    asset_id:str
    metric:str
class EdgeIn(Strict):
    upstream:str
    downstream:str
    relationship:Literal['electricity','fuel','heat','water','data']
    backup:bool=False
class InventoryCreateIn(Strict):
    name:str=Field(min_length=2,max_length=100)
    category:Literal['fuel','spare','provisions','medical','other']
    location:str=Field(min_length=2,max_length=100)
    unit:Literal['L','each','kg','kits']
    reorder_point:FiniteFloat=Field(ge=0)
    asset_code:str|None=None
    evidence:str=Field(min_length=5,max_length=1000)
