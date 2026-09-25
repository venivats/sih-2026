// Exercise the browser-only persistence adapter without a DOM or network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
const fixture = JSON.parse(await readFile("public/demo-maitri.json", "utf8"));
const values = new Map();
globalThis.location = { search: "?browser-demo=1" };
globalThis.sessionStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
globalThis.fetch = async (url) => {
  assert.equal(url, "/demo-maitri.json");
  return { ok: true, json: async () => structuredClone(fixture) };
};
async function load(path) {
  const r = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    define: {
      "import.meta.env.DEV": "false",
      "import.meta.env.VITE_API_BASE_URL": '""',
    },
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(r.outputFiles[0].text).toString("base64")
  );
}
const api = await load("src/api.ts"),
  ops = await load("src/operationsModel.ts");
test("two isolated browser demos retain the complete inspection and handover workflow", async () => {
  const first = await api.startSession(),
    second = await api.startSession();
  assert.notEqual(first, second);
  const other = await api.snapshot(second, "maitri");
  const act = (path, body, method) =>
    api.mutate(first, "maitri", path, body, method);
  const exercise = await act("/exercises", {
    preset: "overheat",
    idempotency_key: "exercise-guide-001",
  });
  assert.ok(exercise.alert_id);
  await act("/alerts/" + exercise.alert_id + "/acknowledge");
  const order = await act("/alerts/" + exercise.alert_id + "/work-orders", {
    assignee: "Fictional engineer",
    due_date: "2026-09-26",
  });
  const create = (kind, label, data, key) =>
    act("/operations", { kind, label, data, idempotency_key: key });
  const crew = await create(
    "crew",
    "Fictional engineer",
    {
      role: "Maintenance",
      status: "on_duty",
      shift_start: "2026-01-01T00:00:00Z",
      shift_end: "2030-01-01T00:00:00Z",
    },
    "demo-crew-001",
  );
  const plan = await create(
    "field_plan",
    "External inspection",
    {
      crew_id: crew.id,
      asset_id: exercise.asset_id,
      work_order_id: order.id,
      centre_x: 200,
      centre_y: 0,
      radius_m: 160,
      restricted_x: 390,
      restricted_y: 70,
      restricted_radius_m: 65,
      check_in_due: "2026-09-26T12:00:00Z",
      note: "Illustrative local geometry for verification.",
    },
    "demo-plan-001",
  );
  const event = await create(
    "field_event",
    "Inspection received",
    {
      crew_id: crew.id,
      plan_id: plan.id,
      position_id: null,
      event: "inspection",
      note: "Inspection complete. Temperature recovery remains unverified.",
    },
    "demo-event-001",
  );
  await assert.rejects(
    () =>
      act("/operations/" + event.id, { version: 0, data: event.data }, "PATCH"),
    /immutable/,
  );
  await act("/work-orders/" + order.id, { status: "in_progress" }, "PATCH");
  await act(
    "/work-orders/" + order.id,
    {
      status: "resolved",
      notes: "Fictional inspection completed and documented in the field log.",
    },
    "PATCH",
  );
  const d = await api.snapshot(first, "maitri");
  assert.equal(
    d.alerts.find((a) => a.id === exercise.alert_id).recovered,
    false,
  );
  const report = ops.handover(d);
  const saved = await create(
    "handover",
    "Inspection handover",
    { snapshot: report, text: report.text, model_version: "handover-v1" },
    "demo-handover-001",
  );
  const reload = await api.snapshot(first, "maitri");
  assert.equal(
    reload.operations
      .find((r) => r.id === saved.id)
      .data.snapshot.inputs.work_orders.find((w) => w.id === order.id).status,
    "resolved",
  );
  const otherAfter = await api.snapshot(second, "maitri");
  delete otherAfter.fetched_at;
  delete other.fetched_at;
  assert.deepEqual(otherAfter, other);
  await assert.rejects(
    () =>
      api.mutate("demo", "maitri", "/exercises", {
        preset: "overheat",
        idempotency_key: "forbidden-001",
      }),
    /private demo/,
  );
});
