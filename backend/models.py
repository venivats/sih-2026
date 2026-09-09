from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Float, Integer, JSON, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

def uid(): return str(uuid4())
def now(): return datetime.now(timezone.utc).isoformat()
class Entity(Base):
    __abstract__ = True
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=uid)
class Scoped(Entity):
    __abstract__ = True
    workspace: Mapped[str] = mapped_column(String(80), index=True)
    station: Mapped[str] = mapped_column(String(20), index=True)
class Workspace(Entity):
    __tablename__ = 'workspaces'
    kind: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[str] = mapped_column(default=now)
class WasteRecord(Scoped):
    __tablename__ = 'waste_records'
    category: Mapped[str]
    quantity: Mapped[float]
    unit: Mapped[str]
    location: Mapped[str]
    destination: Mapped[str]
    shipment_id: Mapped[str | None]
    evidence: Mapped[str]
    origin: Mapped[str]
    status: Mapped[str] = mapped_column(default='collected')
    history: Mapped[list] = mapped_column(JSON, default=list)
    idempotency_key: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)
    __table_args__ = (CheckConstraint('quantity > 0'), UniqueConstraint('workspace','station','idempotency_key'))
class User(Entity):
    __tablename__ = 'users'
    username: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(30))
class Asset(Scoped):
    __tablename__ = 'assets'
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str]
    kind: Mapped[str]
    critical: Mapped[bool] = mapped_column(default=False)
    capacity: Mapped[float | None]
    capacity_unit: Mapped[str | None]
    position: Mapped[dict] = mapped_column(JSON, default=dict)
    documentation: Mapped[list] = mapped_column(JSON, default=list)
    __table_args__ = (UniqueConstraint('workspace','station','code'),)
class Edge(Scoped):
    __tablename__ = 'edges'
    upstream: Mapped[str]
    downstream: Mapped[str]
    relationship: Mapped[str]
    backup: Mapped[bool] = mapped_column(default=False)
    verified: Mapped[bool] = mapped_column(default=False)
class Source(Scoped):
    __tablename__ = 'sources'
    title: Mapped[str]
    provider: Mapped[str]
    reference: Mapped[str]
    origin: Mapped[str]
    verification: Mapped[str]
    checksum: Mapped[str | None]
    acquired_at: Mapped[str] = mapped_column(default=now)
    parser_version: Mapped[str]
    transformations: Mapped[list] = mapped_column(JSON, default=list)
    storage_key: Mapped[str | None]
    uploader: Mapped[str | None]
    licence: Mapped[str]
class Measurement(Scoped):
    __tablename__ = 'measurements'
    asset_id: Mapped[str]
    metric: Mapped[str]
    value: Mapped[float | None]
    unit: Mapped[str]
    observed_at: Mapped[str]
    ingested_at: Mapped[str] = mapped_column(default=now)
    source_id: Mapped[str]
    origin: Mapped[str]
    processing: Mapped[str] = mapped_column(default='raw')
    verification: Mapped[str]
    quality: Mapped[str] = mapped_column(default='unchecked')
    lineage: Mapped[list] = mapped_column(JSON, default=list)
    __table_args__ = (UniqueConstraint('workspace','station','asset_id','metric','observed_at'),)
class Rule(Scoped):
    __tablename__ = 'rules'
    asset_id: Mapped[str]
    metric: Mapped[str]
    threshold: Mapped[float]
    recovery_threshold: Mapped[float]
    debounce: Mapped[int] = mapped_column(default=2)
    streak: Mapped[int] = mapped_column(default=0)
    last_observed: Mapped[str | None]
    active_alert: Mapped[str | None]
    assumption: Mapped[str]
class Alert(Scoped):
    __tablename__ = 'alerts'
    asset_id: Mapped[str]
    rule_id: Mapped[str]
    measurement_id: Mapped[str]
    title: Mapped[str]
    severity: Mapped[str] = mapped_column(default='warning')
    status: Mapped[str] = mapped_column(default='open')
    recovered: Mapped[bool] = mapped_column(default=False)
    recovered_at: Mapped[str | None]
    acknowledged_by: Mapped[str | None]
    created_at: Mapped[str] = mapped_column(default=now)
class WorkOrder(Scoped):
    __tablename__ = 'work_orders'
    alert_id: Mapped[str] = mapped_column(unique=True)
    asset_id: Mapped[str]
    title: Mapped[str]
    assignee: Mapped[str]
    priority: Mapped[str]
    due_date: Mapped[str]
    status: Mapped[str] = mapped_column(default='open')
    diagnosis: Mapped[str] = mapped_column(default='Suspected cooling degradation; not a confirmed diagnosis.')
    resolution: Mapped[str | None]
    created_at: Mapped[str] = mapped_column(default=now)
class Inventory(Scoped):
    __tablename__ = 'inventory'
    name: Mapped[str]
    category: Mapped[str]
    location: Mapped[str]
    quantity: Mapped[float]
    unit: Mapped[str]
    reorder_point: Mapped[float]
    asset_code: Mapped[str | None]
    source_id: Mapped[str]
    version: Mapped[int] = mapped_column(default=0)
    __table_args__ = (CheckConstraint('quantity >= 0'),UniqueConstraint('workspace','station','name'))
class Ledger(Scoped):
    __tablename__ = 'ledger'
    item_id: Mapped[str]
    delta: Mapped[float]
    balance: Mapped[float]
    kind: Mapped[str]
    reason: Mapped[str]
    work_order_id: Mapped[str | None]
    idempotency_key: Mapped[str]
    actor: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)
    __table_args__ = (UniqueConstraint('workspace','idempotency_key'),)
class Reservation(Scoped):
    __tablename__ = 'reservations'
    item_id: Mapped[str]
    work_order_id: Mapped[str]
    quantity: Mapped[float]
    remaining: Mapped[float]
    status: Mapped[str] = mapped_column(default='reserved')
    idempotency_key: Mapped[str]
    actor: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)
    __table_args__ = (UniqueConstraint('workspace','idempotency_key'),CheckConstraint('remaining >= 0 AND remaining <= quantity'))
class Shipment(Scoped):
    __tablename__ = 'shipments'
    name: Mapped[str]
    eta: Mapped[str]
    status: Mapped[str]
    manifest: Mapped[list] = mapped_column(JSON)
    history: Mapped[list] = mapped_column(JSON)
    risk: Mapped[str]
class Replenishment(Scoped):
    __tablename__ = 'replenishments'
    item_id: Mapped[str]
    quantity: Mapped[float]
    status: Mapped[str] = mapped_column(default='requested')
    requested_by: Mapped[str]
    idempotency_key: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)
    __table_args__ = (UniqueConstraint('workspace','idempotency_key'),)
class Audit(Scoped):
    __tablename__ = 'audit'
    actor: Mapped[str]
    action: Mapped[str]
    entity_id: Mapped[str]
    details: Mapped[dict] = mapped_column(JSON,default=dict)
    created_at: Mapped[str] = mapped_column(default=now)
class ImportBatch(Scoped):
    __tablename__ = 'import_batches'
    source_id: Mapped[str]
    rows: Mapped[list] = mapped_column(JSON)
    errors: Mapped[list] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(default='preview')
    created_at: Mapped[str] = mapped_column(default=now)
class Acquisition(Scoped):
    __tablename__ = 'acquisitions'
    provider: Mapped[str]
    reference: Mapped[str]
    status: Mapped[str]
    detail: Mapped[str]
    source_id: Mapped[str | None]
    acquired_at: Mapped[str] = mapped_column(default=now)
class Attachment(Scoped):
    __tablename__ = 'attachments'
    work_order_id: Mapped[str]
    filename: Mapped[str]
    storage_key: Mapped[str]
    checksum: Mapped[str]
    uploader: Mapped[str]
    created_at: Mapped[str] = mapped_column(default=now)
