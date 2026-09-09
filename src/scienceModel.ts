import type { Snapshot } from "./types";
export function thermal(
  tin: number,
  tout: number,
  target: number,
  capacity: number,
  loss: number,
) {
  if (
    ![tin, tout, target, capacity, loss].every(Number.isFinite) ||
    capacity <= 0 ||
    loss <= 0 ||
    tin <= target ||
    target <= tout
  )
    return null;
  return (capacity / loss) * Math.log((tin - tout) / (target - tout));
}
export function capacityPath(
  d: Snapshot,
  source: string,
  target: string,
  failed: string,
  transfer: boolean,
  derating: number,
) {
  const asset = d.assets.find((a) => a.id === source);
  if (!asset || asset.capacity === null || asset.capacity_unit !== "kW")
    return {
      capacity: null,
      path: [] as string[],
      reason: "Source capacity in kW is unavailable",
    };
  if (!transfer)
    return {
      capacity: 0,
      path: [] as string[],
      reason: "Transfer assumed unavailable",
    };
  const queue = [{ id: source, path: [source] }],
    seen = new Set<string>();
  while (queue.length) {
    const x = queue.shift()!;
    if (x.id === failed || seen.has(x.id)) continue;
    seen.add(x.id);
    if (x.id === target) {
      const bottleneck = Math.min(
        ...x.path.map((id) => {
          const a = d.assets.find((a) => a.id === id)!;
          return a.capacity_unit === "kW" && a.capacity !== null
            ? a.capacity
            : Infinity;
        }),
      );
      return {
        capacity: Math.max(0, (bottleneck * derating) / 100),
        path: x.path,
        reason:
          "Illustrative ceiling: known path kW capacities × derating. Unspecified line ratings assumed non-limiting; voltage, transients and protection coordination unmodelled.",
      };
    }
    for (const e of d.edges.filter(
      (e) => e.upstream === x.id && e.relationship === "electricity",
    ))
      queue.push({ id: e.downstream, path: [...x.path, e.downstream] });
  }
  return {
    capacity: 0,
    path: [] as string[],
    reason:
      "No surviving registered electricity path. Missing topology can change the conclusion.",
  };
}
export function qualityFindings(d: Snapshot) {
  const out: { id: string; kind: string; detail: string }[] = [];
  const groups = new Map<string, typeof d.measurements>();
  for (const m of d.measurements) {
    const key = m.asset_id + "|" + m.metric + "|" + m.source_id;
    groups.set(key, [...(groups.get(key) || []), m]);
    if (m.value === null)
      out.push({
        id: m.id,
        kind: "Missing",
        detail: "Null value preserved; no interpolation",
      });
    if (!Number.isFinite(Date.parse(m.observed_at)))
      out.push({
        id: m.id,
        kind: "Timestamp",
        detail: "Observation timestamp cannot be parsed",
      });
    if (
      !["good", "ok", "valid", "simulated", "synthetic", "missing"].includes(
        m.quality,
      )
    )
      out.push({ id: m.id, kind: "Provider flag", detail: m.quality });
    if (
      m.value !== null &&
      (m.metric === "soc" || m.metric === "humidity") &&
      (m.value < 0 || m.value > 100)
    )
      out.push({
        id: m.id,
        kind: "Range",
        detail: "Outside 0–100 %; unit and sensor definition need review",
      });
  }
  for (const series of groups.values()) {
    const rows = [...series].sort((a, b) =>
      a.observed_at.localeCompare(b.observed_at),
    );
    const intervals = rows
      .slice(1)
      .map(
        (m, i) => Date.parse(m.observed_at) - Date.parse(rows[i].observed_at),
      )
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    const typical = intervals[Math.floor(intervals.length / 2)];
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i],
        delta = Date.parse(b.observed_at) - Date.parse(a.observed_at);
      if (typical && delta > typical * 2)
        out.push({
          id: b.id,
          kind: "Gap",
          detail: "Interval >2× series median cadence; heuristic",
        });
      if (delta === 0)
        out.push({
          id: b.id,
          kind: "Duplicate time",
          detail: "Same source, asset, metric and observation time",
        });
      if (
        b.value !== null &&
        a.value !== null &&
        ["temperature", "coolant_temperature"].includes(b.metric) &&
        delta > 0 &&
        Math.abs(b.value - a.value) / (delta / 3600000) > 10
      )
        out.push({
          id: b.id,
          kind: "Rapid change",
          detail: "Change >10 °C/hour; demonstration heuristic, not diagnosis",
        });
      if (
        i >= 4 &&
        b.value !== null &&
        rows.slice(i - 4, i + 1).every((m) => m.value === b.value)
      )
        out.push({
          id: b.id,
          kind: "Flat sequence",
          detail: "Five identical readings; stable conditions or sensor issue",
        });
    }
  }
  return out;
}
export function benchmark() {
  // Fully synthetic benchmark. Deterministic noise; no provider attribution.
  const samples = Array.from(
      { length: 120 },
      (_, i) => 80 + (((i * 37) % 17) - 8) * 0.15,
    ),
    train = samples.slice(0, 80),
    mean = train.reduce((a, b) => a + b, 0) / 80,
    sd = Math.sqrt(train.reduce((a, b) => a + (b - mean) ** 2, 0) / 80);
  const truth = new Set([85, 94, 103, 112]);
  for (const i of truth) samples[i] += i === 94 ? 5 : 12;
  const score = (rule: (v: number) => boolean) => {
    let tp = 0,
      fp = 0,
      fn = 0,
      tn = 0;
    for (let i = 80; i < 120; i++) {
      const yes = rule(samples[i]);
      if (truth.has(i)) {
        if (yes) tp++;
        else fn++;
      } else if (yes) fp++;
      else tn++;
    }
    return { tp, fp, fn, tn };
  };
  return {
    train: 80,
    test: 40,
    mean,
    sd,
    threshold: score((v) => v > 90),
    statistical: score((v) => Math.abs(v - mean) > 3 * sd),
  };
}
