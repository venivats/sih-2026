"""Pydantic response schemas derived from declared ORM types (never table values)."""
from typing import get_type_hints,get_args
from pydantic import BaseModel,ConfigDict,create_model
from . import models

def output(model):
    hints=get_type_hints(model)
    return create_model(model.__name__+'Out',__config__=ConfigDict(from_attributes=True),**{c.name:(get_args(hints[c.name])[0],...) for c in model.__table__.columns})
AssetOut=output(models.Asset)
EdgeOut=output(models.Edge)
MeasurementOut=output(models.Measurement)
SourceOut=output(models.Source)
AlertOut=output(models.Alert)
RuleOut=output(models.Rule)
WorkOrderOut=output(models.WorkOrder)
InventoryOut=output(models.Inventory)
LedgerOut=output(models.Ledger)
ReservationOut=output(models.Reservation)
ShipmentOut=output(models.Shipment)
ReplenishmentOut=output(models.Replenishment)
AuditOut=output(models.Audit)
AcquisitionOut=output(models.Acquisition)
AttachmentOut=output(models.Attachment)
ImportBatchOut=output(models.ImportBatch)
WasteOut=output(models.WasteRecord)
class SnapshotOut(BaseModel):
    workspace:str
    station:str
    fetched_at:str
    assets:list[AssetOut]
    edges:list[EdgeOut]
    measurements:list[MeasurementOut]
    sources:list[SourceOut]
    alerts:list[AlertOut]
    rules:list[RuleOut]
    work_orders:list[WorkOrderOut]
    inventory:list[InventoryOut]
    ledger:list[LedgerOut]
    reservations:list[ReservationOut]
    shipments:list[ShipmentOut]
    audit:list[AuditOut]
    replenishments:list[ReplenishmentOut]
    acquisitions:list[AcquisitionOut]
    attachments:list[AttachmentOut]
    waste:list[WasteOut]
