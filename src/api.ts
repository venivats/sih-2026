import { randomId } from "./id";
import type { Snapshot } from "./types";
// Explicit browser-only mode also allows evaluating the public deployment locally.
export const API =
  new URLSearchParams(location.search).get("browser-demo") === "1"
    ? ""
    : import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "/api" : "");
export let bearer = "";
export function setBearer(v: string) {
  bearer = v;
}
export async function request(path: string, body?: unknown, method?: string) {
  if (!API)
    throw new Error("Persistent server is not connected to this public demo.");
  const form = body instanceof FormData || body instanceof URLSearchParams;
  const r = await fetch(API + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
      ...(!form && body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? (form ? (body as FormData) : JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(
      typeof d.detail === "string"
        ? d.detail
        : JSON.stringify(d.detail || r.statusText),
    );
  }
  return r.json();
}
export const path = (w: string, s: string) => `/w/${w}/${s}`;
export async function snapshot(w: string, s: string): Promise<Snapshot> {
  if (API) return request(path(w, s) + "/snapshot");
  if (w === "operational")
    return {
      workspace: w,
      station: s,
      fetched_at: "",
      assets: [],
      edges: [],
      measurements: [],
      sources: [],
      alerts: [],
      work_orders: [],
      inventory: [],
      ledger: [],
      shipments: [],
      rules: [],
      audit: [],
      replenishments: [],
      acquisitions: [],
      attachments: [],
    };
  const stored =
    w === "browser-demo" ? sessionStorage.getItem("polaris-demo-" + s) : null;
  if (stored) return JSON.parse(stored);
  const r = await fetch("/demo-" + s + ".json");
  if (!r.ok) throw new Error("Demonstration snapshot unavailable");
  const d = await r.json();
  if (w === "browser-demo") {
    d.workspace = w;
    sessionStorage.setItem("polaris-demo-" + s, JSON.stringify(d));
  }
  return d;
}
export async function startSession() {
  if (API) {
    const r = await request("/demo-sessions", {});
    setBearer(r.access_token);
    return r.workspace;
  }
  return "browser-demo";
}
async function mutateUnserialized(
  w: string,
  s: string,
  endpoint: string,
  body: Record<string, unknown> = {},
  method = "POST",
) {
  if (API) return request(path(w, s) + endpoint, body, method);
  if (w !== "browser-demo")
    throw new Error("Start a private demo to make changes.");
  const d = await snapshot(w, s),
    now = new Date().toISOString();
  let result: unknown = {};
  const id = endpoint.split("/")[2];
  const log = (
    action: string,
    entity: string,
    details: Record<string, unknown> = {},
  ) =>
    d.audit.push({
      id: randomId(),
      actor: "This browser tab",
      entity_id: entity,
      action,
      details,
      created_at: now,
    });
  if (endpoint === "/exercises") {
    if (
      !["overheat", "recovery"].includes(String(body.preset)) ||
      String(body.idempotency_key || "").length < 8
    )
      throw new Error("Invalid exercise request");
    const previous = d.audit.find(
      (a) =>
        a.action === "exercise_completed" &&
        a.entity_id === body.idempotency_key,
    );
    if (previous) {
      if (previous.details.preset !== body.preset)
        throw new Error("Idempotency key reused");
      return previous.details;
    }
    const asset = d.assets.find((a) => a.code === "GEN-A");
    const rule = d.rules.find(
      (r) => r.asset_id === asset?.id && r.metric === "coolant_temperature",
    );
    const source = d.sources.find((s) => s.origin === "simulation");
    const last = d.measurements
      .filter(
        (m) => m.asset_id === asset?.id && m.metric === "coolant_temperature",
      )
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
    if (!asset || !rule || !source || !last)
      throw new Error("Exercise baseline is incomplete");
    if (body.preset === "overheat" && rule.threshold >= 94)
      throw new Error("94 °C does not breach the configured rule");
    const values =
      body.preset === "overheat"
        ? Array(rule.debounce).fill(94)
        : [rule.recovery_threshold - 1];
    const ids = values.map(
      (value, i) =>
        applyDemoReading(
          d,
          {
            asset_id: asset.id,
            source_id: source.id,
            metric: "coolant_temperature",
            value,
            unit: "degC",
            observed_at: new Date(
              Date.parse(last.observed_at) + (i + 1) * 60000,
            ).toISOString(),
          },
          now,
          log,
        ).id,
    );
    result = {
      preset: body.preset,
      model_version: "exercise-v1",
      measurement_ids: ids,
      alert_id: rule.active_alert,
      asset_id: asset.id,
      assumption:
        "Synthetic historical training readings; no equipment control.",
    };
    log(
      "exercise_completed",
      String(body.idempotency_key),
      result as Record<string, unknown>,
    );
  } else if (endpoint.endsWith("/acknowledge")) {
    const a = d.alerts.find((a) => a.id === id);
    if (!a) throw new Error("Alert unavailable");
    a.status = "acknowledged";
    log("alert_acknowledged", a.id);
    result = a;
  } else if (
    endpoint.startsWith("/alerts/") &&
    endpoint.endsWith("/work-orders")
  ) {
    const a = d.alerts.find((a) => a.id === id);
    if (!a || a.status === "open")
      throw new Error("Acknowledge this alert first");
    const existing = d.work_orders.find((x) => x.alert_id === id);
    if (existing) return existing;
    const o = {
      id: randomId(),
      alert_id: id,
      asset_id: a.asset_id,
      title: "Inspect generator cooling circuit",
      assignee: String(body.assignee),
      priority: String(body.priority || "high"),
      due_date: String(body.due_date),
      status: "open",
      diagnosis: "Suspected cooling degradation; diagnosis unconfirmed.",
      resolution: null,
      created_at: now,
    };
    d.work_orders.push(o);
    log("work_order_created", o.id);
    result = o;
  } else if (endpoint.startsWith("/work-orders/")) {
    const o = d.work_orders.find((x) => x.id === id);
    if (!o) throw new Error("Work order unavailable");
    if (
      !(
        (o.status === "open" && body.status === "in_progress") ||
        (o.status === "in_progress" && body.status === "resolved")
      )
    )
      throw new Error("Invalid transition");
    if (
      body.status === "resolved" &&
      String(body.notes || "").trim().length < 10
    )
      throw new Error("Resolution notes need at least 10 characters");
    if (
      body.status === "resolved" &&
      d.reservations?.some(
        (r) => r.work_order_id === id && r.status === "reserved",
      )
    )
      throw new Error("Use or release allocated spares before resolving work");
    o.status = String(body.status);
    o.resolution = body.notes ? String(body.notes) : null;
    log("work_order_" + o.status, o.id, { notes: o.resolution });
    result = o;
  } else if (endpoint === "/inventory/transactions") {
    const v = body as unknown as {
      item_id: string;
      delta: number;
      reason: string;
      kind: string;
      work_order_id: string | null;
      idempotency_key: string;
    };
    const existing = d.ledger.find(
      (l) => l.idempotency_key === v.idempotency_key,
    );
    if (existing) {
      if (existing.item_id !== v.item_id || existing.delta !== v.delta)
        throw new Error("Idempotency key reused");
      return existing;
    }
    const i = d.inventory.find((x) => x.id === v.item_id);
    if (
      !i ||
      !Number.isFinite(v.delta) ||
      v.delta === 0 ||
      i.quantity + v.delta < 0
    )
      throw new Error("Invalid quantity or insufficient stock");
    if (
      v.kind === "spare_use" &&
      !d.work_orders.some(
        (x) => x.id === v.work_order_id && x.status === "in_progress",
      )
    )
      throw new Error("Start the work order before using a spare");
    const allocations = (d.reservations || []).filter(
      (r) => r.item_id === i.id && r.status === "reserved",
    );
    const own = allocations.filter(
      (r) => v.kind === "spare_use" && r.work_order_id === v.work_order_id,
    );
    if (
      i.quantity + v.delta <
      allocations
        .filter((r) => !own.includes(r))
        .reduce((n, r) => n + r.remaining, 0)
    )
      throw new Error("Stock is reserved for maintenance");
    let use = v.kind === "spare_use" ? -v.delta : 0;
    for (const r of own) {
      const used = Math.min(use, r.remaining);
      r.remaining -= used;
      use -= used;
      if (!r.remaining) r.status = "used";
    }
    i.quantity += v.delta;
    i.version++;
    const l = {
      ...v,
      id: randomId(),
      balance: i.quantity,
      actor: "This browser tab",
      created_at: now,
    };
    d.ledger.push(l);
    log("inventory_" + v.kind, l.id, { delta: v.delta, balance: i.quantity });
    result = l;
  } else if (endpoint === "/reservations") {
    d.reservations ||= [];
    const existing = d.reservations.find(
      (r) => r.idempotency_key === body.idempotency_key,
    );
    if (existing) {
      if (
        existing.item_id !== body.item_id ||
        existing.work_order_id !== body.work_order_id ||
        existing.quantity !== Number(body.quantity)
      )
        throw new Error("Idempotency key reused");
      return existing;
    }
    const i = d.inventory.find((i) => i.id === body.item_id),
      o = d.work_orders.find((o) => o.id === body.work_order_id),
      quantity = Number(body.quantity);
    if (
      !i ||
      !o ||
      o.status === "resolved" ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isInteger(quantity)
    )
      throw new Error("Invalid spare allocation");
    const allocated = d.reservations
      .filter((r) => r.item_id === i.id && r.status === "reserved")
      .reduce((n, r) => n + r.remaining, 0);
    if (quantity > i.quantity - allocated)
      throw new Error("Insufficient unreserved stock");
    const r = {
      id: randomId(),
      item_id: i.id,
      work_order_id: o.id,
      quantity,
      remaining: quantity,
      status: "reserved",
      idempotency_key: String(body.idempotency_key),
    };
    d.reservations.push(r);
    log("spare_reserved", r.id, { quantity });
    result = r;
  } else if (
    endpoint.startsWith("/reservations/") &&
    endpoint.endsWith("/release")
  ) {
    const r = d.reservations?.find((r) => r.id === id);
    if (!r) throw new Error("Allocation unavailable");
    if (r.status === "reserved") {
      r.status = "released";
      r.remaining = 0;
      log("spare_released", r.id);
    }
    result = r;
  } else if (endpoint === "/replenishments") {
    if (
      d.replenishments.some(
        (r) => r.item_id === body.item_id && r.status === "requested",
      )
    )
      throw new Error("Replenishment request already open");
    const r = {
      id: randomId(),
      item_id: String(body.item_id),
      quantity: Number(body.quantity),
      status: "requested",
    };
    d.replenishments.push(r);
    log("replenishment_requested", r.id);
    result = r;
  } else if (endpoint === "/waste") {
    d.waste ||= [];
    const old = d.waste.find((r) => r.idempotency_key === body.idempotency_key);
    if (old) {
      if (
        Object.entries(body).some(([k, v]) => old[k as keyof typeof old] !== v)
      )
        throw new Error("Idempotency key reused");
      return old;
    }
    const quantity = Number(body.quantity),
      unit = body.category === "empty_fuel_drums" ? "each" : "kg";
    if (
      ![
        "sewage_sludge",
        "solid_waste",
        "incinerator_ash",
        "empty_fuel_drums",
      ].includes(String(body.category)) ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 1000000 ||
      body.unit !== unit ||
      (unit === "each" && !Number.isInteger(quantity)) ||
      String(body.evidence).trim().length < 10
    )
      throw new Error("Invalid waste quantity, unit or source evidence");
    if (body.shipment_id && !d.shipments.some((s) => s.id === body.shipment_id))
      throw new Error("Shipment unavailable");
    const record = {
      id: randomId(),
      category: String(body.category),
      quantity,
      unit,
      location: String(body.location),
      destination: String(body.destination),
      shipment_id: body.shipment_id ? String(body.shipment_id) : null,
      evidence: String(body.evidence),
      origin: "simulation",
      status: "collected",
      history: [
        {
          at: now,
          status: "collected",
          note: String(body.evidence),
          actor: "This browser tab",
        },
      ],
      idempotency_key: String(body.idempotency_key),
      created_at: now,
    };
    d.waste.push(record);
    result = record;
    log("waste_registered", record.id, { quantity, origin: "simulation" });
  } else if (endpoint.startsWith("/waste/")) {
    const record = d.waste?.find((r) => r.id === id);
    if (!record) throw new Error("Waste record unavailable");
    const next: Record<string, string> = {
      collected: "packed",
      packed: "loaded",
      loaded: "returned",
    };
    if (
      next[record.status] !== body.status ||
      String(body.note || "").trim().length < 10
    )
      throw new Error("Invalid custody transition or missing evidence note");
    if (body.status === "loaded" && !record.shipment_id)
      throw new Error("A registered shipment is required before loading");
    record.status = String(body.status);
    record.history.push({
      at: now,
      status: record.status,
      note: String(body.note),
      actor: "This browser tab",
    });
    result = record;
    log("waste_" + record.status, record.id, { note: body.note });
  } else if (endpoint === "/measurements") {
    result = applyDemoReading(d, body, now, log);
  } else if (endpoint.startsWith("/shipments/")) {
    const shipment = d.shipments.find((x) => x.id === id);
    if (!shipment) throw new Error("Shipment unavailable");
    shipment.status = String(body.status);
    shipment.history.push({
      at: now,
      status: shipment.status,
      note: String(body.note),
    });
    log("shipment_updated", shipment.id);
    result = shipment;
  } else throw new Error("This action requires a connected backend.");
  sessionStorage.setItem("polaris-demo-" + s, JSON.stringify(d));
  return result;
}

function applyDemoReading(
  d: Snapshot,
  body: Record<string, unknown>,
  now: string,
  log: (
    action: string,
    entity: string,
    details?: Record<string, unknown>,
  ) => void,
) {
  const v = body as unknown as {
    asset_id: string;
    source_id: string;
    metric: string;
    value: number;
    unit: string;
    observed_at: string;
  };
  const m = {
    ...v,
    id: randomId(),
    ingested_at: now,
    origin: "simulation",
    processing: "raw",
    verification: "illustrative",
    quality: "synthetic",
    lineage: [v.source_id],
  };
  d.measurements.push(m);
  d.rules
    .filter((r) => r.asset_id === m.asset_id && r.metric === m.metric)
    .forEach((r) => {
      if (r.last_observed && m.observed_at <= r.last_observed) return;
      r.last_observed = m.observed_at;
      if (r.active_alert && m.value <= r.recovery_threshold) {
        const a = d.alerts.find((a) => a.id === r.active_alert);
        if (a) {
          a.recovered = true;
          a.recovered_at = m.observed_at;
          log("sensor_recovered", a.id);
        }
        r.active_alert = null;
      }
      r.streak = m.value > r.threshold ? r.streak + 1 : 0;
      if (!r.active_alert && r.streak >= r.debounce) {
        const a = {
          id: randomId(),
          asset_id: m.asset_id,
          rule_id: r.id,
          measurement_id: m.id,
          title: "Primary generator: coolant temperature above threshold",
          severity: "warning",
          status: "open",
          recovered: false,
          recovered_at: null,
          created_at: now,
        };
        d.alerts.push(a);
        r.active_alert = a.id;
        log("alert_opened", a.id);
      }
    });
  return m;
}

// Serialize tab-local mutations: concurrent clicks cannot replace one another's snapshot.
const pendingWrites = new Map<string, Promise<unknown>>();
export function mutate(
  w: string,
  s: string,
  endpoint: string,
  body: Record<string, unknown> = {},
  method = "POST",
): Promise<unknown> {
  if (API) return request(path(w, s) + endpoint, body, method);
  const key = w + ":" + s;
  const operation = (pendingWrites.get(key) || Promise.resolve())
    .catch(() => {})
    .then(() => mutateUnserialized(w, s, endpoint, body, method));
  pendingWrites.set(key, operation);
  void operation
    .finally(() => {
      if (pendingWrites.get(key) === operation) pendingWrites.delete(key);
    })
    .catch(() => {});
  return operation;
}
