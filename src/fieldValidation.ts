import type { Snapshot } from "./types";
export function validateField(
  d: Snapshot,
  kind: string,
  data: Record<string, any>,
) {
  const keys: Record<string, string[]> = {
    field_plan: [
      "crew_id",
      "asset_id",
      "work_order_id",
      "centre_x",
      "centre_y",
      "radius_m",
      "restricted_x",
      "restricted_y",
      "restricted_radius_m",
      "check_in_due",
      "note",
    ],
    field_position: [
      "crew_id",
      "plan_id",
      "x",
      "y",
      "accuracy_m",
      "observed_at",
      "device_id",
    ],
    field_event: [
      "check_in_due",
      "crew_id",
      "plan_id",
      "position_id",
      "event",
      "note",
    ],
    comparison: [
      "snapshot",
      "daily_burn",
      "delay_days",
      "reserve_litres",
      "note",
    ],
  };
  if (!keys[kind]) return false;
  if (
    Object.keys(data).some((k) => !keys[kind].includes(k)) ||
    keys[kind].some(
      (k) =>
        !["work_order_id", "position_id"].includes(k) &&
        !(kind === "field_event" && k === "check_in_due") &&
        (data[k] === undefined || data[k] === ""),
    )
  )
    throw Error("Invalid or missing record fields");
  if (
    ["field_plan", "field_position"].includes(kind) &&
    d.workspace === "operational"
  )
    throw Error(
      "Field positioning is simulation-only pending validated tracker integration",
    );
  if (
    data.note &&
    (typeof data.note !== "string" ||
      data.note.length < 10 ||
      data.note.length > 2000)
  )
    throw Error("Notes require 10–2000 characters");
  const limits: Record<string, [number, number]> = {
    centre_x: [-5000, 5000],
    centre_y: [-5000, 5000],
    radius_m: [20, 3000],
    restricted_x: [-5000, 5000],
    restricted_y: [-5000, 5000],
    restricted_radius_m: [10, 3000],
    x: [-10000, 10000],
    y: [-10000, 10000],
    accuracy_m: [0, 5000],
    daily_burn: [0.00001, 100000],
    delay_days: [0, 365],
    reserve_litres: [0, 10000000],
  };
  for (const [key, [min, max]] of Object.entries(limits))
    if (
      key in data &&
      (!Number.isFinite(data[key]) || data[key] < min || data[key] > max)
    )
      throw Error("Invalid " + key);
  for (const key of ["observed_at", "check_in_due"])
    if (
      data[key] != null &&
      (!/(Z|[+-]\d\d:\d\d)$/.test(data[key]) ||
        !Number.isFinite(Date.parse(data[key])))
    )
      throw Error("Use a valid timestamp with timezone");
  if (
    kind === "field_position" &&
    (Date.parse(data.observed_at) > Date.now() + 60000 ||
      typeof data.device_id !== "string" ||
      data.device_id.length < 2 ||
      data.device_id.length > 100)
  )
    throw Error("Invalid position timestamp or device");
  if (
    data.crew_id &&
    !d.operations?.some((r) => r.id === data.crew_id && r.kind === "crew")
  )
    throw Error("Crew unavailable");
  if (data.asset_id && !d.assets.some((r) => r.id === data.asset_id))
    throw Error("Asset unavailable");
  if (
    data.work_order_id &&
    !d.work_orders.some(
      (w) => w.id === data.work_order_id && w.asset_id === data.asset_id,
    )
  )
    throw Error("Work order and asset do not match");
  if (
    data.plan_id &&
    !d.operations?.some(
      (r) =>
        r.id === data.plan_id &&
        r.kind === "field_plan" &&
        r.data.crew_id === data.crew_id,
    )
  )
    throw Error("Plan and crew do not match");
  if (
    kind === "field_event" &&
    data.event === "check_in" &&
    !d.operations?.some(
      (r) => r.id === data.plan_id && r.data.check_in_due === data.check_in_due,
    )
  )
    throw Error("Check-in deadline changed; reload the assignment");
  if (
    data.position_id &&
    !d.operations?.some(
      (r) =>
        r.id === data.position_id &&
        r.kind === "field_position" &&
        r.data.plan_id === data.plan_id,
    )
  )
    throw Error("Position and plan do not match");
  if (
    kind === "field_event" &&
    ![
      "check_in",
      "contact_attempt",
      "acknowledgement",
      "inspection",
      "sos",
      "sos_resolved",
    ].includes(data.event)
  )
    throw Error("Invalid field event");
  if (
    kind === "comparison" &&
    (data.snapshot?.workspace !== d.workspace ||
      data.snapshot?.station !== d.station)
  )
    throw Error("Snapshot scope mismatch");
  return true;
}
