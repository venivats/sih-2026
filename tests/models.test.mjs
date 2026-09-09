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
