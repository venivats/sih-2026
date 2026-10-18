import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const fixtures = Object.fromEntries(await Promise.all(["maitri", "bharati"].map(async (station) => [station, JSON.parse(await readFile(`public/demo-${station}.json`, "utf8"))])));
const storage = new Map();
const calls = [];
globalThis.location = { search: "?mode=demo" };
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.fetch = async (url, options) => {
  calls.push(url);
  if (url.startsWith("/api")) throw new Error("Backend unavailable");
  const station = /^\/demo-(maitri|bharati)\.json$/.exec(url)?.[1];
  assert.ok(station, `Unexpected request: ${url}`);
  assert.ok(options.signal, "Static downloads must have a timeout");
  return { ok: true, json: async () => structuredClone(fixtures[station]) };
};
const bundle = await build({
  entryPoints: ["src/api.ts"], bundle: true, write: false, format: "esm", platform: "node",
  define: { "import.meta.env.DEV": "false", "import.meta.env.VITE_API_BASE_URL": '"/api"' },
});
const api = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));

test("both public station demos load when the configured backend is unavailable", async () => {
  calls.length = 0;
  assert.equal(api.API, "/api");
  for (const station of ["maitri", "bharati"]) {
    const data = await api.snapshot("demo", station);
    assert.equal(data.station, station);
    assert.ok(data.assets.length > 0);
  }
  assert.deepEqual(calls, ["/demo-maitri.json", "/demo-bharati.json"]);
});

test("private exercises persist locally and remain isolated with a server configured", async () => {
  calls.length = 0;
  const first = await api.startSession(), second = await api.startSession();
  assert.match(first, /^browser-/);
  assert.notEqual(first, second);
  const other = await api.snapshot(second, "maitri");
  const exercise = await api.mutate(first, "maitri", "/exercises", { preset: "overheat", idempotency_key: "availability-exercise-001" });
  assert.ok(exercise.alert_id);
  await api.mutate(first, "maitri", `/alerts/${exercise.alert_id}/acknowledge`);
  const reloaded = await api.snapshot(first, "maitri");
  assert.equal(reloaded.alerts.find((a) => a.id === exercise.alert_id).status, "acknowledged");
  assert.equal((await api.snapshot(second, "maitri")).audit.length, other.audit.length);
  assert.ok(calls.every((url) => !url.startsWith("/api")));
});

test("operational and existing server-session failures never substitute simulated records", async () => {
  for (const workspace of ["operational", "session-existing"]) {
    calls.length = 0;
    assert.equal(api.usesServer(workspace), true);
    await assert.rejects(api.snapshot(workspace, "maitri"), /Backend unavailable/);
    await assert.rejects(api.mutate(workspace, "maitri", "/exercises", { preset: "overheat" }), /Backend unavailable/);
    assert.ok(calls.every((url) => url.startsWith(`/api/w/${workspace}/maitri/`)));
  }
});
