import type { Snapshot, ScenarioInputs, ScenarioResult } from "./types";
export const latest = (d: Snapshot, metric: string, asset?: string) =>
  d.measurements
    .filter((m) => m.metric === metric && (!asset || m.asset_id === asset))
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
export const n = (v: number | null | undefined, digits = 1) =>
  v == null
    ? "—"
    : v.toLocaleString("en-GB", { maximumFractionDigits: digits });
export const date = (v: string | undefined | null) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    : "Unavailable";
export function energy(d: Snapshot) {
  const gen = latest(d, "generation"),
    load = latest(d, "consumption"),
    burn = latest(d, "fuel_burn"),
    soc = latest(d, "soc"),
    fuel = d.inventory.find((i) => i.name === "Polar diesel"),
    battery = d.assets.find((a) => a.code === "BAT");
  return {
    gen,
    load,
    burn,
    soc,
    fuel,
    battery,
    balance:
      gen?.value != null &&
      load?.value != null &&
      gen.observed_at === load.observed_at
        ? gen.value - load.value
        : null,
    autonomy:
      fuel && burn?.value && burn.value > 0 ? fuel.quantity / burn.value : null,
    reserve:
      battery?.capacity != null && soc?.value != null
        ? (battery.capacity * soc.value) / 100
        : null,
  };
}
export function affected(d: Snapshot, id: string, upstream = false) {
  const set = new Set<string>(),
    queue = [id];
  while (queue.length) {
    const current = queue.pop();
    d.edges.forEach((e) => {
      const [a, b] = upstream
        ? [e.downstream, e.upstream]
        : [e.upstream, e.downstream];
      if (a === current && b !== id && !set.has(b)) {
        set.add(b);
        queue.push(b);
      }
    });
  }
  return d.assets.filter((a) => set.has(a.id));
}
export function calculate(d: Snapshot, v: ScenarioInputs): ScenarioResult {
  const e = energy(d),
    load = e.load?.value,
    gen = e.gen?.value,
    burn = e.burn?.value,
    fuel = e.fuel?.quantity;
  if (load == null || gen == null || burn == null || fuel == null)
    return {
      available: false,
      inputs: v,
      reason: "Baseline power, fuel and burn measurements are required.",
    };
  const demand = Math.max(
      0,
      load *
        (1 + v.demand_increase / 100 + (v.failure === "weather" ? 0.15 : 0)) -
        v.shed_kw,
    ),
    supply = v.failure === "generator" ? v.backup_kw : gen,
    rate = load ? (burn * demand) / load : null;
  return {
    available: true,
    inputs: v,
    demand_kw: demand,
    supply_kw: supply,
    deficit_kw: Math.max(0, demand - supply),
    autonomy_days: rate ? fuel / rate : null,
    delay_reserve_litres: rate === null ? null : fuel - rate * v.delay_days,
    lineage: [e.gen!.id, e.load!.id, e.burn!.id, e.fuel!.id],
    assumptions: [
      "Fuel burn scales linearly with requested demand; generator efficiency is not modelled.",
      "Backup capacity and successful transfer are assumptions.",
      "Severe weather adds an assumed 15% demand. Communications and heating effects use graph reachability.",
      "Reserve is calculated from the baseline over the selected horizon. No arrival or weather prediction.",
    ],
  };
}
