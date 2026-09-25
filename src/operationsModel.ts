import {
  shiftChanges,
  positionFor,
  zoneStatus,
  checkInStatus,
} from "./missionModel";
import type { Snapshot, OpsRecord } from "./types";
import { energy, latest, n, date, affected } from "./model";
export function baseline(d: Snapshot) {
  return d.workspace === "operational"
    ? new Date().toISOString()
    : [...d.measurements].sort((a, b) =>
        b.observed_at.localeCompare(a.observed_at),
      )[0]?.observed_at || null;
}
export function resupply(d: Snapshot, extra = 0, margin = 7) {
  const e = energy(d),
    at = e.burn?.observed_at,
    ship = [...d.shipments]
      .filter(
        (s) => s.status !== "arrived" && Number.isFinite(Date.parse(s.eta)),
      )
      .sort((a, b) => a.eta.localeCompare(b.eta))[0];
  const days =
    ship && at
      ? Math.max(0, (Date.parse(ship.eta) - Date.parse(at)) / 86400000) + extra
      : null;
  const remaining =
    days !== null && e.fuel && e.burn?.value != null
      ? e.fuel.quantity - e.burn.value * days
      : null;
  return {
    ship,
    at,
    days,
    remaining,
    autonomy: e.autonomy,
    margin,
    gap:
      days !== null && e.autonomy !== null
        ? Math.max(0, days + margin - e.autonomy)
        : null,
    lineage: [e.burn?.id, e.fuel?.id].filter(Boolean) as string[],
  };
}
export function weather(d: Snapshot, limit = 20, scenarioWind?: number) {
  const m = latest(d, "wind_speed"),
    at = baseline(d);
  const historical = d.workspace !== "operational";
  if (scenarioWind !== undefined)
    return {
      state: scenarioWind > limit ? "review" : "below",
      value: scenarioWind,
      at,
      reason: "Scenario assumption · no observation or shipment changed",
      ids: [] as string[],
    };
  if (!m || m.value === null || !at)
    return {
      state: "unknown",
      value: null,
      at,
      reason: "Wind observation unavailable",
      ids: [] as string[],
    };
  const age = (Date.parse(at) - Date.parse(m.observed_at)) / 3600000;
  if (
    !Number.isFinite(age) ||
    m.unit !== "m/s" ||
    ![
      "good",
      "ok",
      "valid",
      ...(historical ? ["simulated", "synthetic"] : []),
    ].includes(m.quality) ||
    !["observation", ...(historical ? ["simulation"] : [])].includes(
      m.origin,
    ) ||
    age < 0 ||
    age > 2
  )
    return {
      state: "unknown",
      value: m.value,
      at: m.observed_at,
      reason: "Unable to assess: stale, questionable or non-observation input",
      ids: [m.id],
    };
  return {
    state: m.value > limit ? "review" : "below",
    value: m.value,
    at: m.observed_at,
    reason:
      (historical ? "Historical assessment" : "Recorded assessment") +
      " · 2-hour freshness limit is a demo assumption",
    ids: [m.id],
  };
}
export function crewAvailable(r: OpsRecord, at: string) {
  return (
    r.kind === "crew" &&
    r.data.status === "on_duty" &&
    Date.parse(at) >= Date.parse(r.data.shift_start) &&
    Date.parse(at) <= Date.parse(r.data.shift_end)
  );
}
export function decisions(d: Snapshot) {
  const rows: {
    id: string;
    title: string;
    reason: string;
    owner: string;
    score: number;
    kind: string;
  }[] = [];
  for (const a of d.alerts.filter((x) => !x.recovered)) {
    const downstream = affected(d, a.asset_id).length,
      w = d.work_orders.find(
        (w) => w.alert_id === a.id && w.status !== "resolved",
      );
    rows.push({
      id: a.id,
      title: a.title,
      reason: `${a.severity} severity + ${downstream} reachable dependencies; recovery unconfirmed`,
      owner: w?.assignee || "Unassigned",
      score: (a.severity === "critical" ? 100 : 60) + downstream,
      kind: "alert",
    });
  }
  const r = resupply(d);
  if (r.gap !== null && r.gap > 0)
    rows.push({
      id: r.ship!.id,
      title: "Fuel does not cover resupply plus reserve",
      reason: `${n(r.gap)} days below ETA + ${r.margin}-day assumed reserve`,
      owner: "Logistics review needed",
      score: 80,
      kind: "resupply",
    });
  for (const t of (d.operations || []).filter(
    (r) => r.kind === "outdoor_task" && r.data.status !== "completed",
  )) {
    const w = weather(d, t.data.wind_limit_ms);
    rows.push({
      id: t.id,
      title: t.label,
      reason:
        w.state === "review"
          ? "Wind threshold exceeded"
          : w.state === "unknown"
            ? "Weather evidence needs review"
            : "Planned outdoor task; below wind threshold is not clearance",
      owner:
        d.operations?.find((c) => c.id === t.data.assignee_id)?.label ||
        "Unassigned",
      score: w.state === "review" ? 90 : w.state === "unknown" ? 70 : 20,
      kind: "task",
    });
  }
  return rows.sort((a, b) => b.score - a.score);
}
export function handover(d: Snapshot) {
  const e = energy(d),
    r = resupply(d);
  const changes = shiftChanges(d);
  const field_review = (d.operations || [])
    .filter((r) => r.kind === "field_plan")
    .map((plan) => ({
      plan_id: plan.id,
      assignment: plan.label,
      ...zoneStatus(plan, positionFor(d, plan)),
      check_in_overdue: checkInStatus(d, plan).overdue,
      sos: checkInStatus(d, plan).sos,
    }));
  return {
    changes,
    field_review,
    workspace: d.workspace,
    station: d.station,
    generated_at: new Date().toISOString(),
    observed_at: baseline(d),
    origin:
      d.workspace === "operational"
        ? "mixed record origins; inspect lineage"
        : "historical demonstration",
    inputs: structuredClone({
      measurements: d.measurements,
      inventory: d.inventory,
      ledger: d.ledger,
      shipments: d.shipments,
      alerts: d.alerts,
      work_orders: d.work_orders,
      assets: d.assets,
      edges: d.edges,
      sources: d.sources,
      waste: d.waste || [],
      attachments: d.attachments || [],
      acquisitions: d.acquisitions || [],
      audit: d.audit,
      operations: (d.operations || []).filter((r) => r.kind !== "handover"),
    }),
    fuel_litres: e.fuel?.quantity ?? null,
    fuel_burn_l_day: e.burn?.value ?? null,
    autonomy_days: e.autonomy,
    power_balance_kw: e.balance,
    shipment_eta: r.ship?.eta ?? null,
    decisions: decisions(d),
    lineage: [...r.lineage, ...[e.gen?.id, e.load?.id].filter(Boolean)],
    text: `${d.station.toUpperCase()} handover. Evidence baseline: ${date(baseline(d))}. ${d.workspace === "operational" ? "Operational records" : "Historical demonstration; not live"}. Fuel inventory ${n(e.fuel?.quantity)} L; autonomy ${n(e.autonomy)} days at the recorded burn rate. Power balance ${n(e.balance)} kW. ${d.alerts.filter((a) => !a.recovered).length} unrecovered alerts and ${d.work_orders.filter((w) => w.status !== "resolved").length} unresolved work orders. Expected shipment ${r.ship ? date(r.ship.eta) : "unavailable"}; reserve at ETA ${n(r.remaining)} L. ${decisions(
      d,
    )
      .map((v) => v.title + " — " + v.owner + ".")
      .join(
        " ",
      )} Changes since previous handover: ${changes.items.join(" ")} Field review: ${field_review.map((f) => f.assignment + ": " + f.label + "; " + f.reason + (f.check_in_overdue ? " Check-in overdue." : "") + (f.sos ? " SOS unresolved." : "")).join(" ") || "No field assignments registered."} Missing values are unavailable. Suggested actions require human review.`,
  };
}
export function stationAnswer(d: Snapshot, q: string) {
  const e = energy(d),
    r = resupply(d),
    s = q.toLowerCase();
  let text = "",
    ids: string[] = [];
  if (/resupply|last until|arrival|shipment/.test(s)) {
    text =
      r.days === null
        ? "Shipment ETA or burn baseline is unavailable."
        : `Expected resupply is ${n(r.days)} days after the recorded fuel-burn baseline. Fuel autonomy is ${n(r.autonomy)} days; projected fuel at arrival is ${n(r.remaining)} L. This assumes constant burn and unchanged ETA.`;
    ids = r.lineage;
  } else if (/fuel|diesel/.test(s)) {
    text = `Fuel inventory: ${n(e.fuel?.quantity)} L. Estimated autonomy: ${n(e.autonomy)} days. Formula: ledger stock ÷ recorded daily burn; no invented subsystem allocation.`;
    ids = r.lineage;
  } else if (/power|energy|electric/.test(s)) {
    text = `Recorded generation ${n(e.gen?.value)} kW; demand ${n(e.load?.value)} kW; time-aligned balance ${n(e.balance)} kW.`;
    ids = [e.gen?.id, e.load?.id].filter(Boolean) as string[];
  } else if (/alert|attention|incident/.test(s)) {
    const a = d.alerts.filter((a) => !a.recovered);
    text = a.length
      ? a
          .map(
            (a) =>
              a.title +
              "; " +
              (d.work_orders.find((w) => w.alert_id === a.id)?.assignee ||
                "unassigned"),
          )
          .join(". ")
      : "No unrecovered alerts are recorded. This does not establish equipment health.";
    ids = a.map((a) => a.measurement_id);
  } else if (/change|shift|handover/.test(s)) {
    text = handover(d).text;
    ids = handover(d).lineage as string[];
  } else if (/weather|wind|outside/.test(s)) {
    const w = weather(d);
    text = `${w.value === null ? "Wind unavailable" : n(w.value) + " m/s"}. ${w.reason}. Assumed review threshold 20 m/s; below threshold does not certify safe conditions.`;
    ids = w.ids;
  } else
    text =
      "I can answer questions about fuel, resupply, power, alerts, weather and handover records. I do not have an approved procedure or evidence for that question.";
  return {
    text,
    ids,
    at: baseline(d),
    workspace: d.workspace,
    station: d.station,
  };
}
