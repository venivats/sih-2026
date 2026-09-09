export interface Asset {
  id: string;
  code: string;
  name: string;
  kind: string;
  critical: boolean;
  capacity: number | null;
  capacity_unit: string | null;
  position: { x?: number; y?: number };
  documentation: { title: string; url: string }[];
}
export interface Edge {
  id: string;
  upstream: string;
  downstream: string;
  relationship: string;
  backup: boolean;
  verified: boolean;
}
export interface Reading {
  id: string;
  asset_id: string;
  metric: string;
  value: number | null;
  unit: string;
  observed_at: string;
  ingested_at: string;
  source_id: string;
  origin: string;
  processing: string;
  verification: string;
  quality: string;
  lineage: string[];
}
export interface Source {
  id: string;
  title: string;
  provider: string;
  reference: string;
  origin: string;
  verification: string;
  checksum: string | null;
  acquired_at: string;
  parser_version: string;
  transformations: string[];
  storage_key: string | null;
  uploader: string | null;
  licence: string;
}
export interface Alert {
  id: string;
  asset_id: string;
  rule_id: string;
  measurement_id: string;
  title: string;
  severity: string;
  status: string;
  recovered: boolean;
  recovered_at: string | null;
  created_at: string;
}
export interface WorkOrder {
  id: string;
  alert_id: string;
  asset_id: string;
  title: string;
  assignee: string;
  priority: string;
  due_date: string;
  status: string;
  diagnosis: string;
  resolution: string | null;
  created_at: string;
}
export interface Item {
  id: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  unit: string;
  reorder_point: number;
  asset_code: string | null;
  source_id: string;
  version: number;
}
export interface Ledger {
  id: string;
  item_id: string;
  delta: number;
  balance: number;
  kind: string;
  reason: string;
  work_order_id: string | null;
  idempotency_key: string;
  actor: string;
  created_at: string;
}
export interface Shipment {
  id: string;
  name: string;
  eta: string;
  status: string;
  manifest: { name: string; quantity: number; unit: string }[];
  history: { at: string; status: string; note: string }[];
  risk: string;
}
export interface Rule {
  id: string;
  asset_id: string;
  metric: string;
  threshold: number;
  recovery_threshold: number;
  debounce: number;
  streak: number;
  last_observed: string | null;
  active_alert: string | null;
  assumption: string;
}
export interface WasteRecord {
  id: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  destination: string;
  shipment_id: string | null;
  evidence: string;
  origin: string;
  status: string;
  history: { at: string; status: string; note: string; actor: string }[];
  idempotency_key: string;
  created_at: string;
}
export interface OpsRecord {
  id: string;
  kind: "crew" | "outdoor_task" | "contact" | "research" | "handover";
  label: string;
  data: Record<string, any>;
  origin: string;
  version: number;
  idempotency_key: string;
  created_at: string;
}
export interface Snapshot {
  operations?: OpsRecord[];
  waste?: WasteRecord[];
  workspace: string;
  station: string;
  fetched_at: string;
  assets: Asset[];
  edges: Edge[];
  measurements: Reading[];
  sources: Source[];
  alerts: Alert[];
  work_orders: WorkOrder[];
  inventory: Item[];
  ledger: Ledger[];
  reservations?: {
    id: string;
    item_id: string;
    work_order_id: string;
    quantity: number;
    remaining: number;
    status: string;
    idempotency_key: string;
  }[];
  shipments: Shipment[];
  rules: Rule[];
  audit: {
    id: string;
    entity_id: string;
    actor: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }[];
  replenishments: {
    id: string;
    item_id: string;
    quantity: number;
    status: string;
  }[];
  acquisitions: {
    id: string;
    provider: string;
    status: string;
    detail: string;
    reference: string;
    acquired_at: string;
  }[];
  attachments: {
    id: string;
    work_order_id: string;
    filename: string;
    checksum: string;
  }[];
}
export interface ScenarioInputs {
  failure: string;
  demand_increase: number;
  shed_kw: number;
  delay_days: number;
  backup_kw: number;
}
export interface ScenarioResult {
  available: boolean;
  demand_kw?: number;
  supply_kw?: number;
  deficit_kw?: number;
  autonomy_days?: number | null;
  delay_reserve_litres?: number | null;
  inputs: ScenarioInputs;
  lineage?: string[];
  assumptions?: string[];
  reason?: string;
}
export type Page =
  | "overview"
  | "twin"
  | "energy"
  | "logistics"
  | "environment"
  | "maintenance"
  | "scenarios"
  | "evidence"
  | "operations"
  | "research";
