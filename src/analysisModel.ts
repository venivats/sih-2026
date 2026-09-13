import type { Reading, Snapshot } from "./types";
import { energy } from "./model";
export const ANALYSIS_VERSION = "record-analysis-v1";
const median = (values: number[]) => {
  const x = [...values].sort((a, b) => a - b);
  const i = Math.floor(x.length / 2);
  return x.length % 2 ? x[i] : (x[i - 1] + x[i]) / 2;
};
export const accepted = (m: Reading) =>
  m.value !== null &&
  Number.isFinite(m.value) &&
  Number.isFinite(Date.parse(m.observed_at)) &&
  ["good", "ok", "valid", "synthetic", "simulated"].includes(m.quality);
export function seriesGroups(d: Snapshot) {
  const groups = new Map<string, Reading[]>();
  for (const m of d.measurements) {
    const key = [m.asset_id, m.metric, m.source_id, m.unit, m.origin].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  return [...groups.entries()].map(([key, rows]) => ({
    key,
    rows: [...rows].sort(
      (a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at),
    ),
    asset: d.assets.find((a) => a.id === rows[0].asset_id),
  }));
}
export function robustBaseline(rows: Reading[], window = 20, threshold = 3.5) {
  const invalidTime = rows.some(
    (m) => !Number.isFinite(Date.parse(m.observed_at)),
  );
  const sorted = [...rows].sort(
    (a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at),
  );
  const current = sorted.at(-1),
    preceding = sorted.slice(0, -1).slice(-window);
  const train = preceding.filter(accepted);
  const ids = [...train.map((m) => m.id), ...(current ? [current.id] : [])];
  const base = {
    current,
    ids,
    count: train.length,
    excluded: preceding.length - train.length,
    median: null as number | null,
    mad: null as number | null,
    score: null as number | null,
    low: null as number | null,
    high: null as number | null,
    flag: false,
    status: "unavailable",
    reason: "",
  };
  if (invalidTime)
    return {
      ...base,
      reason:
        "Invalid observation timestamp; resolve the series clock before scoring",
    };
  if (
    !Number.isInteger(window) ||
    window < 12 ||
    !Number.isFinite(threshold) ||
    threshold <= 0
  )
    return {
      ...base,
      reason: "A valid window and positive threshold are required",
    };
  if (!current || !accepted(current))
    return {
      ...base,
      reason:
        "Latest reading is missing, flagged or invalid; no replacement selected",
    };
  if (train.length < 12)
    return {
      ...base,
      reason: "At least 12 valid preceding samples are required",
    };
  if (
    new Set(
      sorted.map((m) =>
        [m.asset_id, m.metric, m.source_id, m.unit, m.origin].join("|"),
      ),
    ).size > 1
  )
    return { ...base, reason: "Mixed source or units; select a single series" };
  const cadence = median(
    train
      .slice(1)
      .map(
        (m, i) => Date.parse(m.observed_at) - Date.parse(train[i].observed_at),
      ),
  );
  const selected = [...preceding, current];
  const duplicate =
    new Set(selected.map((m) => Date.parse(m.observed_at))).size !==
    selected.length;
  const validSequence = [...train, current];
  const gap = validSequence
    .slice(1)
    .some(
      (m, i) =>
        Date.parse(m.observed_at) - Date.parse(validSequence[i].observed_at) >
        cadence * 2,
    );
  if (cadence <= 0 || duplicate || gap)
    return {
      ...base,
      reason:
        "Duplicate timestamps or a gap within the selected baseline prevent scoring",
    };
  const center = median(train.map((m) => m.value!)),
    mad = median(train.map((m) => Math.abs(m.value! - center)));
  if (mad === 0)
    return {
      ...base,
      median: center,
      mad,
      reason:
        "Baseline has zero median absolute deviation; a finite score cannot be estimated",
    };
  const score = (0.6745 * (current.value! - center)) / mad,
    half = (threshold * mad) / 0.6745;
  return {
    ...base,
    median: center,
    mad,
    score,
    low: center - half,
    high: center + half,
    flag: Math.abs(score) > threshold,
    status: "calculated",
    reason:
      "Modified z-score against preceding samples; current sample excluded from baseline. No seasonal calibration or fault diagnosis.",
  };
}
export function fuelTrend(d: Snapshot) {
  const e = energy(d),
    groups = seriesGroups(d).filter(
      (g) => g.rows[0].metric === "fuel_burn" && g.rows[0].unit === "L/day",
    );
  const chosen = groups.find((g) => g.rows.some((m) => m.id === e.burn?.id));
  const rows = chosen?.rows || [],
    valid = rows.filter((m) => accepted(m) && m.value! > 0),
    cutoff = valid.length
      ? Date.parse(valid.at(-1)!.observed_at) - 30 * 86400000
      : Infinity;
  const recent = valid.filter((m) => Date.parse(m.observed_at) >= cutoff);
  const days = new Map<string, Reading[]>();
  for (const m of recent) {
    const day = new Date(m.observed_at).toISOString().slice(0, 10);
    days.set(day, [...(days.get(day) || []), m]);
  }
  const daily = [...days.entries()].map(([day, ms]) => ({
    day,
    value: ms.reduce((a, m) => a + m.value!, 0) / ms.length,
    ids: ms.map((m) => m.id),
  }));
  const ids = [...recent.map((m) => m.id), ...(e.fuel ? [e.fuel.id] : [])];
  const result = {
    daily,
    ids,
    count: daily.length,
    asOf: recent.at(-1)?.observed_at,
    stock: e.fuel?.quantity ?? null,
    mean: null as number | null,
    days: null as number | null,
    range: null as [number, number] | null,
    reason: "",
  };
  if (
    !e.fuel ||
    e.fuel.unit !== "L" ||
    !Number.isFinite(e.fuel.quantity) ||
    e.fuel.quantity < 0 ||
    !e.burn ||
    e.burn.unit !== "L/day" ||
    !accepted(e.burn) ||
    e.burn.value! <= 0
  )
    return {
      ...result,
      reason:
        "Valid nonnegative stock in L and a positive latest burn reading in L/day are required",
    };
  if (daily.length < 7)
    return {
      ...result,
      reason:
        "Need at least 7 distinct UTC days of valid burn readings. Missing days are not filled.",
    };
  const span =
    (Date.parse(daily.at(-1)!.day) - Date.parse(daily[0].day)) / 86400000 + 1;
  if (daily.length / span < 0.8)
    return {
      ...result,
      reason: "Less than 80% daily coverage in the selected 30-day window",
    };
  const mean = daily.reduce((a, m) => a + m.value, 0) / daily.length;
  const rates = daily.map((m) => m.value).sort((a, b) => a - b),
    q = (p: number) => {
      const pos = (rates.length - 1) * p,
        lo = Math.floor(pos);
      return rates[lo] + (rates[Math.ceil(pos)] - rates[lo]) * (pos - lo);
    };
  return {
    ...result,
    mean,
    days: e.fuel.quantity / mean,
    range: [e.fuel.quantity / q(0.9), e.fuel.quantity / q(0.1)] as [
      number,
      number,
    ],
    reason:
      "Current ledger stock ÷ mean of daily sample-average burn rates. Range uses historical 10th–90th rate percentiles, not a statistical confidence interval. No resupply, reserve or changing efficiency modelled.",
  };
}
