import type { Snapshot, OpsRecord } from "./types";
export function validateOps(
  d: Snapshot,
  kind: string,
  data: Record<string, any>,
) {
  const defs: Record<string, string[]> = {
    crew: ["role", "status", "shift_start", "shift_end"],
    outdoor_task: [
      "assignee_id",
      "shipment_id",
      "status",
      "wind_limit_ms",
      "scheduled_at",
      "note",
    ],
    contact: ["assignee_id", "starts_at", "ends_at", "status", "note"],
    research: ["asset_id", "owner_id", "interruption_hours", "note"],
    handover: ["text", "snapshot", "model_version"],
  };
  if (!defs[kind] || Object.keys(data).some((k) => !defs[kind].includes(k)))
    throw Error("Invalid record fields");
  for (const key of defs[kind].filter((k) => k !== "shipment_id"))
    if (data[key] === undefined || data[key] === "")
      throw Error("Missing " + key);
  for (const k of [
    "shift_start",
    "shift_end",
    "scheduled_at",
    "starts_at",
    "ends_at",
  ])
    if (
      k in data &&
      (!/(Z|[+-]\d\d:\d\d)$/.test(data[k]) ||
        !Number.isFinite(Date.parse(data[k])))
    )
      throw Error("Use a valid timestamp with timezone");
  for (const [a, b] of [
    ["shift_start", "shift_end"],
    ["starts_at", "ends_at"],
  ])
    if (a in data && Date.parse(data[b]) <= Date.parse(data[a]))
      throw Error("End must follow start");
  const statuses: Record<string, string[]> = {
    crew: ["on_duty", "off_duty", "rotation_due"],
    outdoor_task: ["planned", "on_hold", "completed"],
    contact: ["planned", "completed", "missed"],
  };
  if (statuses[kind] && !statuses[kind].includes(data.status))
    throw Error("Invalid status");
  if (data.note && (data.note.length < 10 || data.note.length > 2000))
    throw Error("Notes require 10–2000 characters");
  for (const [key, max] of [
    ["wind_limit_ms", 100],
    ["interruption_hours", 8760],
  ] as const)
    if (
      key in data &&
      (!Number.isFinite(data[key]) ||
        data[key] < 0 ||
        data[key] > max ||
        (key === "wind_limit_ms" && data[key] === 0))
    )
      throw Error("Invalid numeric assumption");
  for (const key of ["assignee_id", "owner_id"])
    if (
      key in data &&
      !d.operations?.some((c) => c.id === data[key] && c.kind === "crew")
    )
      throw Error("Crew record unavailable");
  if (data.shipment_id && !d.shipments.some((s) => s.id === data.shipment_id))
    throw Error("Shipment unavailable");
  if (data.asset_id && !d.assets.some((a) => a.id === data.asset_id))
    throw Error("Asset unavailable");
  if (
    kind === "handover" &&
    (data.snapshot.workspace !== d.workspace ||
      data.snapshot.station !== d.station)
  )
    throw Error("Snapshot scope mismatch");
}
