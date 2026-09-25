import type { Snapshot, OpsRecord } from "./types";
import { energy } from "./model";

export const LOCATION_MAX_AGE_MS = 120000; // Demonstration assumption, not a station procedure.
export function positionFor(d: Snapshot, plan: OpsRecord) {
  return (d.operations || [])
    .filter((r) => r.kind === "field_position" && r.data.plan_id === plan.id)
    .reverse()
    .sort(
      (a, b) =>
        Date.parse(b.data.observed_at) - Date.parse(a.data.observed_at) ||
        b.created_at.localeCompare(a.created_at),
    )[0];
}
export function zoneStatus(
  plan: OpsRecord,
  pos?: OpsRecord,
  clock = Date.now(),
) {
  if (!pos)
    return {
      state: "unknown",
      label: "Location unavailable",
      reason: "No position has been received for this assignment.",
    };
  const p = pos.data,
    z = plan.data,
    age = clock - Date.parse(p.observed_at);
  if (
    ![
      p.x,
      p.y,
      p.accuracy_m,
      z.centre_x,
      z.centre_y,
      z.radius_m,
      z.restricted_x,
      z.restricted_y,
      z.restricted_radius_m,
    ].every(Number.isFinite) ||
    p.accuracy_m < 0 ||
    z.radius_m <= 0 ||
    z.restricted_radius_m <= 0 ||
    !Number.isFinite(age) ||
    age < -60000 ||
    age > LOCATION_MAX_AGE_MS
  )
    return {
      state: "unknown",
      label: "Location stale or invalid",
      reason:
        "A recent, valid position is required. The last marker is historical.",
    };
  const distance = Math.hypot(p.x - z.centre_x, p.y - z.centre_y),
    restricted = Math.hypot(p.x - z.restricted_x, p.y - z.restricted_y);
  if (
    restricted + p.accuracy_m < z.restricted_radius_m ||
    distance - p.accuracy_m > z.radius_m
  )
    return {
      state: "breach",
      label: "Zone breach alert",
      reason:
        "Position and its reported accuracy circle lie outside the assigned area or inside the restricted area. Operator review required.",
    };
  if (
    restricted - p.accuracy_m <= z.restricted_radius_m + 20 ||
    distance + p.accuracy_m >= z.radius_m - 20
  )
    return {
      state: "review",
      label: "Boundary review",
      reason:
        "The position uncertainty or a 20 m demonstration buffer overlaps a boundary. A breach is not established.",
    };
  return {
    state: "inside",
    label: "Within assigned area",
    reason:
      "Recent position is within the configured area. This is a location classification, not a safety guarantee.",
  };
}
export function checkInStatus(
  d: Snapshot,
  plan: OpsRecord,
  clock = Date.now(),
) {
  const events = (d.operations || [])
    .filter((r) => r.kind === "field_event" && r.data.plan_id === plan.id)
    .reverse();
  const due = Date.parse(plan.data.check_in_due);
  const last = events
    .filter((r) => r.data.event === "check_in")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const sos = events
    .filter((r) => ["sos", "sos_resolved"].includes(r.data.event))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    last,
    overdue:
      Number.isFinite(due) &&
      clock > due &&
      (!last || Date.parse(last.data.check_in_due) !== due),
    sos: sos?.data.event === "sos",
  };
}
export function compareFuel(
  d: Snapshot,
  dailyBurn: number,
  delayDays: number,
  reserve: number,
) {
  const e = energy(d),
    ship = [...d.shipments]
      .filter((s) => s.status !== "arrived")
      .sort((a, b) => a.eta.localeCompare(b.eta))[0];
  const at = e.burn?.observed_at;
  const days =
    ship && at ? (Date.parse(ship.eta) - Date.parse(at)) / 86400000 : NaN;
  const available =
    !!e.fuel &&
    e.fuel.unit === "L" &&
    Number.isFinite(e.fuel.quantity) &&
    e.fuel.quantity >= 0 &&
    e.burn?.unit === "L/day" &&
    Number.isFinite(e.burn.value) &&
    Number(e.burn.value) > 0 &&
    Number.isFinite(days) &&
    days >= 0 &&
    Number.isFinite(dailyBurn) &&
    dailyBurn > 0 &&
    Number.isFinite(delayDays) &&
    delayDays >= 0 &&
    delayDays <= 365 &&
    Number.isFinite(reserve) &&
    reserve >= 0;
  if (!available)
    return {
      available: false as const,
      reason:
        "A valid fuel balance (L), positive burn observation (L/day), and shipment ETA after the observation baseline are required.",
    };
  const fuel = e.fuel!,
    burn = e.burn!,
    usable = Math.max(0, fuel.quantity - reserve),
    baselineDays = usable / Number(burn.value),
    alternativeDays = usable / dailyBurn;
  return {
    available: true as const,
    fuel: fuel.quantity,
    baselineBurn: Number(burn.value),
    dailyBurn,
    reserve,
    at,
    ship,
    days,
    baselineDays,
    alternativeDays,
    baselineMargin: fuel.quantity - Number(burn.value) * days - reserve,
    alternativeMargin: fuel.quantity - dailyBurn * (days + delayDays) - reserve,
    baselineGap: Math.max(0, days - baselineDays),
    alternativeGap: Math.max(0, days + delayDays - alternativeDays),
    lineage: [burn.id, fuel.id, ship!.id],
  };
}
export function shiftChanges(d: Snapshot) {
  const previous = (d.operations || [])
    .filter((r) => r.kind === "handover")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const old = previous?.data.snapshot?.inputs as Partial<Snapshot> | undefined;
  if (!old)
    return {
      previous: null,
      items: [
        "First handover: establishes a baseline for the next shift comparison.",
      ],
    };
  const items: string[] = [];
  for (const a of d.alerts) {
    const prev = old.alerts?.find((x) => x.id === a.id);
    if (!prev) items.push("New alert: " + a.title);
    else if (prev.status !== a.status || prev.recovered !== a.recovered)
      items.push(
        `Alert changed: ${a.title} · ${a.status} · ${a.recovered ? "sensor recovered" : "sensor unrecovered"}`,
      );
  }
  for (const w of d.work_orders) {
    const prev = old.work_orders?.find((x) => x.id === w.id);
    if (!prev) items.push(`New work: ${w.title} · owner ${w.assignee}`);
    else if (
      prev.status !== w.status ||
      prev.assignee !== w.assignee ||
      prev.resolution !== w.resolution
    )
      items.push(
        `Work changed: ${w.title} · ${w.status} · owner ${w.assignee}`,
      );
  }
  for (const l of d.ledger.filter(
    (l) => !old.ledger?.some((x) => x.id === l.id),
  ))
    items.push(
      `Stock movement: ${d.inventory.find((i) => i.id === l.item_id)?.name || l.item_id} ${l.delta > 0 ? "+" : ""}${l.delta} · ${l.reason}`,
    );
  for (const r of (d.operations || []).filter(
    (r) =>
      r.kind === "field_event" && !old.operations?.some((x) => x.id === r.id),
  ))
    items.push(
      `Field event: ${r.data.event.replaceAll("_", " ")} · ${r.label}`,
    );
  for (const s of d.shipments) {
    const prev = old.shipments?.find((x) => x.id === s.id);
    if (!prev || prev.eta !== s.eta || prev.status !== s.status)
      items.push(`Shipment changed: ${s.name} · ${s.status} · ETA ${s.eta}`);
  }
  return {
    previous: {
      id: previous.id,
      label: previous.label,
      created_at: previous.created_at,
    },
    items: items.length
      ? items
      : [
          "No changes in alerts, work, stock movements, field events or shipments since the previous saved handover.",
        ],
  };
}
export function incidentEvents(d: Snapshot, id: string) {
  const a = d.alerts.find((a) => a.id === id);
  if (!a) return [];
  const orders = d.work_orders.filter((w) => w.alert_id === id),
    ids = new Set([id, ...orders.map((w) => w.id)]);
  const positions = (d.operations || []).filter(
    (r) =>
      r.kind === "field_plan" &&
      orders.some((w) => w.id === r.data.work_order_id),
  );
  const events = [
    {
      id: a.id,
      at: a.created_at,
      title: "Alert opened",
      detail: a.title,
      kind: "Alert record",
    },
    ...d.audit
      .filter((x) => ids.has(x.entity_id))
      .map((x) => ({
        id: x.id,
        at: x.created_at,
        title: x.action.replaceAll("_", " "),
        detail: JSON.stringify(x.details),
        kind: "Audit record",
      })),
    ...(d.operations || [])
      .filter(
        (r) =>
          r.kind === "field_event" &&
          positions.some((p) => p.id === r.data.plan_id),
      )
      .map((r) => ({
        id: r.id,
        at: r.created_at,
        title: r.data.event.replaceAll("_", " "),
        detail: r.data.note,
        kind: "Field record",
      })),
  ];
  if (a.recovered_at)
    events.push({
      id: "recovery-" + a.id,
      at: a.recovered_at,
      title: "Sensor recovery recorded",
      detail: "Qualifying recovery reading recorded; work closure is separate.",
      kind: "Alert record",
    });
  return events.sort((a, b) => a.at.localeCompare(b.at));
}
