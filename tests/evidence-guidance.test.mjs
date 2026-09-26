import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/evidenceModel.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const evidence = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));

test("guide and handover links stay within the station and the actual incident", () => {
  const a = { workspace: "browser-a", station: "maitri" };
  const b = { workspace: "browser-a", station: "bharati" };
  assert.notEqual(evidence.guideKey(a), evidence.guideKey(b));
  const d = { ...a, operations: [
    { kind: "handover", id: "unrelated", data: { snapshot: { inputs: { work_orders: [{ alert_id: "other", status: "resolved" }] } } } },
    { kind: "handover", id: "draft", data: { snapshot: { inputs: { work_orders: [{ alert_id: "incident-a", status: "in_progress" }] } } } },
    { kind: "handover", id: "matched", data: { snapshot: { inputs: { work_orders: [{ alert_id: "incident-a", status: "resolved" }] } } } },
  ] };
  assert.deepEqual(evidence.incidentHandovers(d, "incident-a").map(x => x.id), ["matched"]);
  assert.deepEqual(evidence.incidentHandovers(d, "incident-b"), []);
});

test("observation age cannot be mistaken for retrieval freshness", () => {
  const now = Date.parse("2026-09-26T00:00:00Z");
  assert.equal(evidence.readingAge({ observed_at: "2026-09-05T00:00:00Z" }, now), "21 days old");
  assert.equal(evidence.readingAge({ observed_at: "unparseable" }, now), "Observation time invalid");
  assert.equal(evidence.readingAge({ observed_at: "2026-09-26T01:00:00Z" }, now), "Future timestamp: review required");
  assert.equal(evidence.originLabel("simulation"), "Simulated");
});
