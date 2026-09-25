import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
async function module(path) {
  const r = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(r.outputFiles[0].text).toString("base64")
  );
}
const ops = await module("src/operationsModel.ts"),
  science = await module("src/scienceModel.ts");
const original = JSON.parse(await readFile("public/demo-maitri.json", "utf8"));
const fresh = () => structuredClone(original);
test("resupply uses shared stock and shipment ETA; delay does not mutate records", () => {
  const d = fresh(),
    before = JSON.stringify(d),
    base = ops.resupply(d),
    delayed = ops.resupply(d, 45);
  assert.equal(base.days, 75);
  assert.ok(Math.abs(base.autonomy - 28400 / 780) < 1e-9);
  assert.equal(delayed.remaining, 28400 - 780 * 120);
  assert.equal(JSON.stringify(d), before);
  d.inventory = [];
  assert.equal(ops.resupply(d).remaining, null);
  assert.equal(ops.resupply(d).autonomy, null);
});
test("weather rejects stale, missing and gridded inputs and preserves storm isolation", () => {
  const d = fresh();
  assert.equal(ops.weather(d).state, "below");
  assert.equal(ops.weather(d, 20, 130 / 3.6).state, "review");
  assert.equal(ops.weather(d).state, "below");
  d.measurements = d.measurements.filter((m) => m.metric !== "wind_speed");
  assert.equal(ops.weather(d).state, "unknown");
  const wind = {
    ...original.measurements.find((m) => m.metric === "wind_speed"),
    observed_at: "2020-01-01T00:00:00Z",
    value: 25,
  };
  d.measurements.push(wind);
  assert.equal(ops.weather(d).state, "unknown");
  wind.observed_at = ops.baseline(d);
  wind.origin = "reanalysis";
  assert.equal(ops.weather(d).state, "unknown");
});
test("handover freezes input records and missing values remain null", () => {
  const d = fresh(),
    r = ops.handover(d),
    before = r.inputs.inventory[0].quantity;
  d.inventory[0].quantity = 0;
  assert.equal(r.inputs.inventory[0].quantity, before);
  d.inventory = [];
  d.measurements = [];
  const empty = ops.handover(d);
  assert.equal(empty.power_balance_kw, null);
  assert.equal(empty.autonomy_days, null);
  assert.match(ops.stationAnswer(d, "fuel").text, /—/);
  assert.match(
    ops.stationAnswer(d, "official emergency procedure").text,
    /do not have an approved procedure/,
  );
});
test("capacity accounts for failed distribution and transfer; thermal validates physical domain", () => {
  const d = fresh(),
    by = (code) => d.assets.find((a) => a.code === code).id;
  assert.equal(
    science.capacityPath(d, by("GEN-B"), by("LOAD"), by("GEN-A"), true, 80)
      .capacity,
    144,
  );
  assert.equal(
    science.capacityPath(d, by("GEN-B"), by("LOAD"), by("BUS"), true, 80)
      .capacity,
    0,
  );
  assert.equal(
    science.capacityPath(d, by("GEN-B"), by("LOAD"), by("GEN-A"), false, 80)
      .capacity,
    0,
  );
  const hours = science.thermal(20, -30, 5, 100, 2);
  assert.ok(hours > 0);
  assert.equal(science.thermal(20, -30, 5, 200, 2), hours * 2);
  assert.equal(science.thermal(20, 10, 5, 100, 2), null);
  assert.equal(science.thermal(20, -30, 5, 100, 0), null);
});
test("quality screening and synthetic benchmark preserve source records", () => {
  const d = fresh();
  const m = d.measurements[0];
  d.measurements.push(
    { ...m, id: "null", value: null },
    { ...m, id: "duplicate" },
  );
  const before = JSON.stringify(d),
    findings = science.qualityFindings(d);
  assert.ok(findings.some((x) => x.kind === "Missing"));
  assert.ok(findings.some((x) => x.kind === "Duplicate time"));
  assert.equal(JSON.stringify(d), before);
  const b = science.benchmark();
  assert.equal(b.train, 80);
  assert.equal(b.test, 40);
  for (const s of [b.threshold, b.statistical])
    assert.equal(s.tp + s.tn + s.fp + s.fn, 40);
  assert.deepEqual(science.benchmark(), b);
});

const analysis = await module("src/analysisModel.ts");
test("recorded robust baseline excludes the current sample, preserves gaps and source boundaries", () => {
  const template = original.measurements[0];
  const rows = Array.from({ length: 21 }, (_, i) => ({
    ...template,
    id: "r" + i,
    observed_at: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
    value: i === 20 ? 100 : 78 + (i % 5),
    quality: "good",
  }));
  const before = JSON.stringify(rows),
    r = analysis.robustBaseline(rows);
  assert.equal(r.flag, true);
  assert.equal(r.count, 20);
  assert.equal(r.median, 80);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(
    analysis.robustBaseline(rows.map((m) => ({ ...m, value: 80 }))).score,
    null,
  );
  assert.equal(
    analysis.robustBaseline(
      rows.map((m, i) => (i === 20 ? { ...m, value: null } : m)),
    ).score,
    null,
  );
  assert.equal(
    analysis.robustBaseline(
      rows.map((m, i) =>
        i === 20 ? { ...m, source_id: "another-source" } : m,
      ),
    ).score,
    null,
  );
  assert.equal(
    analysis.robustBaseline(
      rows.map((m, i) =>
        i === 20 ? { ...m, observed_at: "2026-02-01T00:00:00Z" } : m,
      ),
    ).score,
    null,
  );
  assert.equal(
    analysis.robustBaseline(
      rows.map((m, i) =>
        i === 8 ? { ...m, observed_at: rows[7].observed_at } : m,
      ),
    ).score,
    null,
  );
  assert.equal(
    analysis.robustBaseline(
      rows.map((m, i) => (i === 8 ? { ...m, observed_at: "invalid" } : m)),
    ).score,
    null,
  );
  assert.equal(
    analysis.robustBaseline(rows.filter((m, i) => i < 7 || i > 10)).score,
    null,
  );
});
test("fuel outlook requires real history length; one ledger stock drives calculation and missing days stay missing", () => {
  const d = fresh();
  assert.equal(analysis.fuelTrend(d).days, null);
  const template = d.measurements.find((m) => m.metric === "fuel_burn");
  d.measurements = d.measurements.filter((m) => m.metric !== "fuel_burn");
  d.measurements.push(
    ...Array.from({ length: 10 }, (_, i) => ({
      ...template,
      id: "burn" + i,
      observed_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      value: 700 + i * 10,
      quality: "good",
    })),
  );
  const before = JSON.stringify(d),
    r = analysis.fuelTrend(d);
  assert.equal(r.count, 10);
  assert.equal(r.mean, 745);
  assert.equal(r.days, 28400 / 745);
  assert.ok(r.range[0] < r.days && r.range[1] > r.days);
  assert.equal(JSON.stringify(d), before);
  d.inventory = [];
  assert.equal(analysis.fuelTrend(d).days, null);
});
test("fuel outlook refuses invalid units, nonpositive rates and sparse coverage", () => {
  const d = fresh(),
    template = d.measurements.find((m) => m.metric === "fuel_burn");
  d.measurements = Array.from({ length: 8 }, (_, i) => ({
    ...template,
    id: "sparse" + i,
    observed_at: new Date(Date.UTC(2026, 0, 1 + i * 3)).toISOString(),
    value: 700,
    quality: "good",
  }));
  assert.equal(analysis.fuelTrend(d).days, null);
  d.measurements.forEach(
    (m, i) =>
      (m.observed_at = new Date(Date.UTC(2026, 0, 1 + i)).toISOString()),
  );
  assert.ok(analysis.fuelTrend(d).days > 0);
  d.measurements.at(-1).value = 0;
  assert.equal(analysis.fuelTrend(d).days, null);
  d.measurements.at(-1).value = 700;
  d.inventory.find((i) => i.name === "Polar diesel").unit = "kg";
  assert.equal(analysis.fuelTrend(d).days, null);
});

const mission = await module("src/missionModel.ts");
const fieldValidation = await module("src/fieldValidation.ts");
const clock = Date.parse("2026-09-25T10:00:00Z");
const fieldPlan = {
  id: "plan",
  kind: "field_plan",
  label: "Inspection",
  data: {
    crew_id: "crew",
    asset_id: "asset",
    centre_x: 0,
    centre_y: 0,
    radius_m: 100,
    restricted_x: 400,
    restricted_y: 0,
    restricted_radius_m: 50,
    check_in_due: "2026-09-25T09:59:00Z",
  },
};
const point = (x, y, accuracy_m = 5, age = 0) => ({
  id: "position",
  kind: "field_position",
  created_at: new Date(clock).toISOString(),
  data: {
    plan_id: "plan",
    crew_id: "crew",
    x,
    y,
    accuracy_m,
    observed_at: new Date(clock - age).toISOString(),
  },
});
test("location classes account for uncertainty, stale readings and reported accuracy", () => {
  assert.equal(
    mission.zoneStatus(fieldPlan, point(0, 0), clock).state,
    "inside",
  );
  assert.equal(
    mission.zoneStatus(fieldPlan, point(96, 0), clock).state,
    "review",
  );
  assert.equal(
    mission.zoneStatus(fieldPlan, point(120, 0, 40), clock).state,
    "review",
  );
  assert.equal(
    mission.zoneStatus(fieldPlan, point(150, 0), clock).state,
    "breach",
  );
  assert.equal(
    mission.zoneStatus(fieldPlan, point(400, 0), clock).state,
    "breach",
  );
  assert.equal(
    mission.zoneStatus(fieldPlan, point(0, 0, 5, 120001), clock).state,
    "unknown",
  );
  assert.equal(
    mission.zoneStatus(fieldPlan, point(0, 0, 5, -120000), clock).state,
    "unknown",
  );
  assert.equal(
    mission.zoneStatus(fieldPlan, point(0, 0, -5), clock).state,
    "unknown",
  );
  assert.equal(
    mission.zoneStatus(fieldPlan, undefined, clock).state,
    "unknown",
  );
});
test("late positions cannot replace more recent observations; check-in and SOS remain distinct", () => {
  const d = fresh(),
    newer = point(0, 0),
    older = {
      ...point(150, 0, 5, 180000),
      id: "old",
      created_at: new Date(clock + 1000).toISOString(),
    };
  d.operations = [fieldPlan, newer, older];
  assert.equal(mission.positionFor(d, fieldPlan).id, newer.id);
  assert.equal(mission.checkInStatus(d, fieldPlan, clock).overdue, true);
  const event = {
    kind: "field_event",
    data: {
      plan_id: "plan",
      event: "check_in",
      check_in_due: fieldPlan.data.check_in_due,
    },
    created_at: new Date(clock - 120000).toISOString(),
  };
  d.operations.push(event);
  assert.equal(mission.checkInStatus(d, fieldPlan, clock).overdue, false);
  assert.equal(
    mission.checkInStatus(
      d,
      {
        ...fieldPlan,
        data: { ...fieldPlan.data, check_in_due: "2026-09-25T09:59:30Z" },
      },
      clock,
    ).overdue,
    true,
  );
  d.operations.push({
    ...event,
    data: { ...event.data, event: "sos" },
    created_at: new Date(clock + 1).toISOString(),
  });
  d.operations.push({
    ...event,
    created_at: new Date(clock + 2).toISOString(),
  });
  assert.equal(mission.checkInStatus(d, fieldPlan, clock).sos, true);
  d.operations.push({
    ...event,
    data: { ...event.data, event: "sos_resolved" },
    created_at: new Date(clock + 3).toISOString(),
  });
  assert.equal(mission.checkInStatus(d, fieldPlan, clock).sos, false);
});
test("fuel comparisons use explicit alternative assumptions without changing the source", () => {
  const d = fresh(),
    before = JSON.stringify(d),
    r = mission.compareFuel(d, 650, 3, 500);
  assert.equal(r.available, true);
  assert.equal(r.days, 75);
  assert.equal(r.baselineMargin, 28400 - 780 * 75 - 500);
  assert.equal(r.alternativeMargin, 28400 - 650 * 78 - 500);
  assert.equal(JSON.stringify(d), before);
  assert.equal(mission.compareFuel(d, 0, 0, 0).available, false);
  d.inventory.find((i) => i.category === "fuel").unit = "kg";
  assert.equal(mission.compareFuel(d, 650, 3, 500).available, false);
});
test("handovers report changes against the previous preserved input snapshot", () => {
  const d = fresh(),
    first = ops.handover(d);
  assert.equal(first.changes.previous, null);
  d.operations = [
    {
      id: "h1",
      kind: "handover",
      label: "Previous shift",
      created_at: "2026-09-25T09:00:00Z",
      data: { snapshot: first },
    },
  ];
  const oldStatus = d.alerts[0].status;
  d.alerts[0].status = "acknowledged";
  d.operations.push({
    id: "inspection",
    kind: "field_event",
    label: "External inspection",
    data: { event: "inspection" },
    created_at: "2026-09-25T10:00:00Z",
  });
  const next = ops.handover(d);
  assert.equal(next.changes.previous.id, "h1");
  assert.ok(
    next.changes.items.some((s) => s.includes("Field event: inspection")),
  );
  assert.equal(first.inputs.alerts[0].status, oldStatus);
  assert.equal(
    next.inputs.operations.some((r) => r.kind === "handover"),
    false,
  );
});
test("browser record validation rejects cross-plan evidence and operational geometry", () => {
  const d = fresh();
  d.operations = [
    { id: "crew", kind: "crew" },
    fieldPlan,
    {
      ...point(0, 0),
      id: "foreign-point",
      data: { ...point(0, 0).data, plan_id: "other-plan" },
    },
  ];
  assert.throws(
    () =>
      fieldValidation.validateField(d, "field_event", {
        crew_id: "crew",
        plan_id: "plan",
        position_id: "foreign-point",
        event: "inspection",
        note: "A detailed inspection note.",
      }),
    /Position and plan/,
  );
  d.workspace = "operational";
  assert.throws(
    () =>
      fieldValidation.validateField(d, "field_plan", {
        ...fieldPlan.data,
        note: "Illustrative geometry for testing only.",
      }),
    /simulation-only/,
  );
});
