import { useEffect, useState } from "react";
import {
  MapPin,
  Radio,
  Navigation,
  ClipboardCheck,
  Users,
  ArrowUpRight,
} from "lucide-react";
import type { Props } from "./pages";
import type { OpsRecord } from "./types";
import { Badge, Empty, Notice, Panel } from "./components";
import { mutate } from "./api";
import { Explanation } from "./Explanation";
import { randomId } from "./id";
import { date, n } from "./model";
import { canWrite } from "./permissions";
import { positionFor, zoneStatus, checkInStatus } from "./missionModel";
import { CrewMotion } from "./LiveExercises";

export function CrewField(p: Props) {
  const records = p.d.operations || [],
    plans = records.filter((r) => r.kind === "field_plan"),
    crew = records.filter((r) => r.kind === "crew");
  const [selected, setSelected] = useState(""),
    [clock, setClock] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState("map"),
    [note, setNote] = useState(""),
    [kind, setKind] = useState("check_in");
  const [layers, setLayers] = useState({
    zones: true,
    crew: true,
    assets: true,
  });
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const plan = plans.find((r) => r.id === selected) || plans[0],
    person = crew.find((r) => r.id === plan?.data.crew_id),
    pos = plan ? positionFor(p.d, plan) : undefined,
    state = plan ? zoneStatus(plan, pos, clock) : null,
    contact = plan ? checkInStatus(p.d, plan, clock) : null;
  const write = p.write && canWrite(p.role, "operations"),
    simulation = p.d.workspace !== "operational";
  const save = async (
    kind: string,
    label: string,
    data: Record<string, unknown>,
    key = randomId(),
  ) =>
    mutate(p.d.workspace, p.d.station, "/operations", {
      kind,
      label,
      data,
      idempotency_key: key,
    }) as Promise<OpsRecord>;
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await p.refresh();
      p.notify("Record saved. Field geometry remains illustrative.");
    } catch (e) {
      p.notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function seed() {
    const token = "field-demo-v1";
    let c = crew.find((r) => r.idempotency_key === token + "-crew");
    if (!c)
      c = await save(
        "crew",
        "Crew C-03 · fictional engineer",
        {
          role: "Maintenance",
          status: "on_duty",
          shift_start: "2026-01-01T00:00:00Z",
          shift_end: "2030-01-01T00:00:00Z",
        },
        token + "-crew",
      );
    const asset = p.d.assets.find((a) => a.code === "GEN-A") || p.d.assets[0];
    if (!asset) throw Error("Add an asset before creating a field assignment.");
    let plan = plans.find((r) => r.idempotency_key === token + "-plan");
    if (!plan)
      plan = await save(
        "field_plan",
        "External equipment inspection",
        {
          crew_id: c.id,
          asset_id: asset.id,
          work_order_id:
            p.d.work_orders.find(
              (w) => w.asset_id === asset.id && w.status !== "resolved",
            )?.id || null,
          centre_x: 200,
          centre_y: 0,
          radius_m: 160,
          restricted_x: 390,
          restricted_y: 70,
          restricted_radius_m: 65,
          check_in_due: new Date(Date.now() + 1800000).toISOString(),
          note: "Fictional work area for software demonstration. Coordinates are illustrative local offsets, not a surveyed station map.",
        },
        token + "-plan",
      );
    await save("field_position", "Initial simulated position", {
      crew_id: c.id,
      plan_id: plan.id,
      x: 180,
      y: 0,
      accuracy_m: 12,
      observed_at: new Date().toISOString(),
      device_id: "simulated-tracker-C03",
    });
    setSelected(plan.id);
  }
  async function move(x: number, y: number, stale = false) {
    if (!plan) return;
    await save("field_position", "Simulated tracker update", {
      crew_id: plan.data.crew_id,
      plan_id: plan.id,
      x,
      y,
      accuracy_m: 12,
      observed_at: new Date(Date.now() - (stale ? 180000 : 0)).toISOString(),
      device_id: "simulated-tracker-" + plan.data.crew_id,
    });
  }
  const events = records
    .filter((r) => r.kind === "field_event" && r.data.plan_id === plan?.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const relevantAsset = p.d.assets.find((a) => a.id === plan?.data.asset_id);
  const allPoints = plans.flatMap((z) => [
    [z.data.centre_x - z.data.radius_m, z.data.centre_y - z.data.radius_m],
    [z.data.centre_x + z.data.radius_m, z.data.centre_y + z.data.radius_m],
    [
      z.data.restricted_x - z.data.restricted_radius_m,
      z.data.restricted_y - z.data.restricted_radius_m,
    ],
    [
      z.data.restricted_x + z.data.restricted_radius_m,
      z.data.restricted_y + z.data.restricted_radius_m,
    ],
    ...(positionFor(p.d, z)
      ? [[positionFor(p.d, z)!.data.x, positionFor(p.d, z)!.data.y]]
      : []),
  ]);
  const minX = Math.min(-100, ...allPoints.map((a) => a[0])) - 40,
    maxX = Math.max(520, ...allPoints.map((a) => a[0])) + 40,
    minY = Math.min(-240, ...allPoints.map((a) => a[1])) - 40,
    maxY = Math.max(220, ...allPoints.map((a) => a[1])) + 40;
  const scale = Math.min(690 / (maxX - minX), 370 / (maxY - minY)),
    sx = (x: number) => 45 + (x - minX) * scale,
    sy = (y: number) => 35 + (maxY - y) * scale;
  return (
    <div className="mission-workspace">
      <div className="mission-heading">
        <div>
          <span className="eyebrow">PEOPLE / ASSIGNMENTS / CONTACT</span>
          <h2>Crew & field activities</h2>
          <p>Connect a person, a task and its check-in record.</p>
        </div>
        <Badge tone="amber">
          {simulation
            ? "Simulated location exercise"
            : "Tracking not connected"}
        </Badge>
      </div>
      <Notice>
        Local schematic coordinates in metres. Areas and the 2-minute freshness
        limit are demonstration assumptions. This view is not a navigation aid
        or a safety clearance.
      </Notice>
      {simulation && <CrewMotion p={p} />}
      <div className="mission-toolbar">
        <div className="segmented">
          <button aria-pressed={mode === "map"} onClick={() => setMode("map")}>
            <MapPin size={16} /> Station map
          </button>
          <button
            aria-pressed={mode === "field"}
            onClick={() => setMode("field")}
          >
            <ClipboardCheck size={16} /> Field task view
          </button>
        </div>
        <button onClick={() => p.go("operations")}>
          Roster & contact schedules <ArrowUpRight size={15} />
        </button>
      </div>
      {!plans.length ? (
        <Panel title="No field assignments registered">
          <Empty
            title={
              simulation
                ? "Start a crew-location exercise"
                : "No validated tracker integration"
            }
          >
            Use fictional crew to review zone alerts and check-ins in a private
            demonstration.
          </Empty>
          {simulation && (
            <button
              className="primary"
              disabled={!write || busy}
              onClick={() => action(seed)}
            >
              {busy ? "Preparing…" : "Create fictional field assignment"}
            </button>
          )}
          {!write && (
            <p>Start a private demo from the top toolbar to practise.</p>
          )}
        </Panel>
      ) : (
        <>
          <div className="mission-toolbar">
            <label>
              Assignment
              <select
                value={plan?.id || ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                {plans.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <span>
              Refreshed {date(p.d.fetched_at)} ·{" "}
              {navigator.onLine
                ? "Connected browser"
                : "Offline browser — cached view"}
            </span>
          </div>
          <div className={mode === "map" ? "field-grid" : "field-focus"}>
            {mode === "map" && (
              <Panel
                title="Assigned work areas"
                sub="Station schematic · no surveyed geography"
              >
                <div
                  className="mission-toolbar"
                  role="group"
                  aria-label="Map layers"
                >
                  {Object.entries(layers).map(([key, on]) => (
                    <label className="check-label" key={key}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setLayers({ ...layers, [key]: e.target.checked })
                        }
                      />
                      {key === "assets"
                        ? "Linked equipment"
                        : key === "crew"
                          ? "Crew positions"
                          : "Work areas"}
                    </label>
                  ))}
                </div>
                <svg
                  className="crew-map"
                  viewBox="0 0 800 460"
                  role="img"
                  aria-label="Illustrative crew map. Equivalent location status and distances are listed in the adjacent assignment panel."
                >
                  <defs>
                    <pattern
                      id="field-grid"
                      width="40"
                      height="40"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.5"
                      />
                    </pattern>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width="800"
                    height="460"
                    fill="url(#field-grid)"
                    opacity=".2"
                  />
                  <rect
                    x={sx(0) - 20}
                    y={sy(0) - 20}
                    width="40"
                    height="40"
                    rx="7"
                    className="map-station"
                  />
                  <text x={sx(0)} y={sy(0) + 40} textAnchor="middle">
                    Station reference
                  </text>
                  {plans.map((r) => {
                    const l = positionFor(p.d, r),
                      st = zoneStatus(r, l, clock);
                    return (
                      <g key={r.id} opacity={r.id === plan?.id ? 1 : 0.35}>
                        {layers.zones && (
                          <>
                            <circle
                              cx={sx(r.data.centre_x)}
                              cy={sy(r.data.centre_y)}
                              r={r.data.radius_m * scale}
                              className="map-assigned"
                            />
                            <text
                              x={sx(r.data.centre_x)}
                              y={sy(r.data.centre_y + r.data.radius_m) + 22}
                              textAnchor="middle"
                            >
                              Assigned area
                            </text>
                            <circle
                              cx={sx(r.data.restricted_x)}
                              cy={sy(r.data.restricted_y)}
                              r={r.data.restricted_radius_m * scale}
                              className="map-restricted"
                            />
                            <text
                              x={sx(r.data.restricted_x)}
                              y={sy(r.data.restricted_y)}
                              textAnchor="middle"
                            >
                              Restricted
                            </text>
                          </>
                        )}
                        {layers.assets && (
                          <>
                            <path
                              d={`M ${sx(0)} ${sy(0)} L ${sx(r.data.centre_x)} ${sy(r.data.centre_y)}`}
                              className="map-link"
                            />
                            <rect
                              x={sx(r.data.centre_x) - 8}
                              y={sy(r.data.centre_y) - 8}
                              width="16"
                              height="16"
                              className="map-station"
                            />
                            <text
                              x={sx(r.data.centre_x)}
                              y={sy(r.data.centre_y) + 28}
                              textAnchor="middle"
                            >
                              {
                                p.d.assets.find((a) => a.id === r.data.asset_id)
                                  ?.code
                              }
                            </text>
                          </>
                        )}
                        {layers.crew && l && (
                          <g className={"map-person " + st.state}>
                            <circle
                              cx={sx(l.data.x)}
                              cy={sy(l.data.y)}
                              r={Math.max(4, l.data.accuracy_m * scale)}
                              opacity=".25"
                            />
                            <circle cx={sx(l.data.x)} cy={sy(l.data.y)} r="8" />
                            <text x={sx(l.data.x) + 14} y={sy(l.data.y) - 15}>
                              {crew
                                .find((c) => c.id === r.data.crew_id)
                                ?.label.split(" · ")[0] || "Crew"}
                              {st.state === "unknown" ? " · last known" : ""}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                  <text x="25" y="442">
                    North ↑ · offsets from an illustrative station reference
                  </text>
                </svg>
                <div className="map-legend">
                  <span>Blue: assigned area</span>
                  <span>Dashed amber: restricted area</span>
                  <span>Circle around crew: reported uncertainty</span>
                </div>
              </Panel>
            )}
            <Panel
              title={person?.label || "Crew member"}
              sub={person?.data.role}
            >
              <Badge
                tone={
                  state?.state === "inside"
                    ? "teal"
                    : state?.state === "unknown"
                      ? "muted"
                      : "amber"
                }
              >
                {state?.label}
              </Badge>
              <p>{state?.reason}</p>
              {contact?.sos && (
                <Notice tone="amber">
                  SOS recorded — unresolved. Review the contact log. This
                  prototype does not dispatch emergency assistance.
                </Notice>
              )}
              <dl>
                <dt>Assigned task</dt>
                <dd>{plan?.label}</dd>
                <dt>Linked asset</dt>
                <dd>
                  <button
                    className="text-button"
                    onClick={() => relevantAsset && p.select(relevantAsset)}
                  >
                    {relevantAsset?.name || "Unavailable"}
                  </button>
                </dd>
                <dt>Distance from reference</dt>
                <dd>
                  {pos
                    ? n(Math.hypot(pos.data.x, pos.data.y)) + " m"
                    : "Unavailable"}
                </dd>
                <dt>Position observed</dt>
                <dd>{date(pos?.data.observed_at)}</dd>
                <dt>Position received</dt>
                <dd>{date(pos?.created_at)}</dd>
                <dt>Reported accuracy</dt>
                <dd>{pos ? n(pos.data.accuracy_m) + " m" : "Unavailable"}</dd>
                <dt>Next check-in</dt>
                <dd>
                  {date(plan?.data.check_in_due)}
                  {contact?.overdue && <Badge tone="amber">Overdue</Badge>}
                </dd>
                <dt>Last check-in</dt>
                <dd>{date(contact?.last?.created_at)}</dd>
              </dl>
              <Explanation
                d={p.d}
                title="Crew location classification"
                formula="Distance = √((x − centre x)² + (y − centre y)²). Compare the full reported accuracy circle with the area boundary."
                inputs={[
                  {
                    label: "Assigned radius",
                    value: n(plan?.data.radius_m) + " m",
                  },
                  {
                    label: "Reported accuracy",
                    value: pos ? n(pos.data.accuracy_m) + " m" : "Unavailable",
                  },
                  {
                    label: "Position observed",
                    value: date(pos?.data.observed_at),
                  },
                  { label: "Result", value: state?.label || "Unavailable" },
                ]}
                assumptions={[
                  "Coordinates and restricted area are fictional; no surveyed map is connected.",
                  "Freshness limit: 2 minutes. Boundary review buffer: 20 m. Both are prototype assumptions.",
                  "A breach requires the full accuracy circle outside the assigned area or inside the restricted area.",
                  "Stale or invalid positions produce Unknown. SOS is a separate manually recorded event.",
                ]}
                ids={[plan!.id, ...(pos ? [pos.id] : [])]}
              />
              {plan?.data.work_order_id && (
                <button
                  onClick={() =>
                    p.detail?.("work-orders", plan.data.work_order_id)
                  }
                >
                  Open assigned work order
                </button>
              )}
            </Panel>
          </div>
          <div className="field-grid">
            <Panel
              title="Record a field update"
              sub="Writes are sent immediately; delivery is confirmed after the server accepts them."
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    await save("field_event", plan!.label, {
                      crew_id: plan!.data.crew_id,
                      plan_id: plan!.id,
                      position_id: pos?.id || null,
                      event: kind,
                      check_in_due:
                        kind === "check_in" ? plan!.data.check_in_due : null,
                      note,
                    });
                    setNote("");
                  });
                }}
              >
                <label>
                  Update type
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="check_in">Check-in received</option>
                    <option value="contact_attempt">Contact attempt</option>
                    <option value="acknowledgement">
                      Acknowledge location alert
                    </option>
                    <option value="inspection">Inspection note</option>
                    <option value="sos">Record SOS</option>
                    <option value="sos_resolved">Record SOS resolution</option>
                  </select>
                </label>
                <label>
                  Evidence / notes
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Who made contact, what was observed, and what remains unresolved?"
                  />
                </label>
                <button className="primary" disabled={!write || busy}>
                  {busy ? "Sending…" : "Save field update"}
                </button>
              </form>
              <p className="muted">
                Offline writes are disabled. Keep notes in view until a save is
                confirmed; no queued delivery is implied.
              </p>
            </Panel>
            <Panel
              title="Contact & inspection log"
              sub="Recorded events, newest first"
            >
              {events.length ? (
                events.map((r) => (
                  <article className="field-event" key={r.id}>
                    <strong>{r.data.event.replaceAll("_", " ")}</strong>
                    <time>{date(r.created_at)}</time>
                    <p>{r.data.note}</p>
                    <button
                      className="text-button"
                      onClick={() => p.evidence([r.id])}
                    >
                      Record details
                    </button>
                  </article>
                ))
              ) : (
                <p>No contact or inspection events recorded.</p>
              )}
            </Panel>
          </div>
          {simulation && (
            <details className="mission-details">
              <summary>Exercise controls & configured work area</summary>
              <Notice>
                These controls create fictional tracker readings. Location
                alerts and check-in alerts are separate.
              </Notice>
              <div className="actions">
                <button
                  disabled={!write || busy}
                  onClick={() =>
                    action(() => move(plan!.data.centre_x, plan!.data.centre_y))
                  }
                >
                  Simulate inside area
                </button>
                <button
                  disabled={!write || busy}
                  onClick={() =>
                    action(() =>
                      move(
                        plan!.data.centre_x + plan!.data.radius_m - 8,
                        plan!.data.centre_y,
                      ),
                    )
                  }
                >
                  Simulate boundary uncertainty
                </button>
                <button
                  disabled={!write || busy}
                  onClick={() =>
                    action(() =>
                      move(
                        plan!.data.centre_x + plan!.data.radius_m + 60,
                        plan!.data.centre_y,
                      ),
                    )
                  }
                >
                  Simulate zone breach
                </button>
                <button
                  disabled={!write || busy}
                  onClick={() =>
                    action(() =>
                      move(plan!.data.centre_x, plan!.data.centre_y, true),
                    )
                  }
                >
                  Send delayed position
                </button>
              </div>
              <p>
                To demonstrate stale state, stop sending positions for two
                minutes. A delayed older reading never replaces a newer
                position.
              </p>
              <form
                className="mission-form"
                key={plan!.id + plan!.version}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  action(async () => {
                    await mutate(
                      p.d.workspace,
                      p.d.station,
                      "/operations/" + plan!.id,
                      {
                        version: plan!.version,
                        data: {
                          ...plan!.data,
                          radius_m: Number(f.get("radius")),
                          work_order_id: String(f.get("work_order")) || null,
                          check_in_due: new Date(
                            String(f.get("due")),
                          ).toISOString(),
                          note: String(f.get("note")),
                        },
                      },
                      "PATCH",
                    );
                  });
                }}
              >
                <label>
                  Linked work order
                  <select
                    name="work_order"
                    defaultValue={plan!.data.work_order_id || ""}
                  >
                    <option value="">No linked order</option>
                    {p.d.work_orders
                      .filter((w) => w.asset_id === plan!.data.asset_id)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.title} · {w.status}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Work-area radius (m)
                  <input
                    name="radius"
                    type="number"
                    min="20"
                    max="3000"
                    required
                    defaultValue={plan!.data.radius_m}
                  />
                </label>
                <label>
                  Next check-in (local time)
                  <input
                    name="due"
                    type="datetime-local"
                    required
                    defaultValue={new Date(
                      Date.parse(plan!.data.check_in_due) -
                        new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)}
                  />
                </label>
                <label>
                  Reason / assumptions
                  <input
                    name="note"
                    required
                    minLength={10}
                    maxLength={2000}
                    defaultValue={plan!.data.note}
                  />
                </label>
                <button disabled={!write || busy}>
                  Save assignment revision
                </button>
              </form>
            </details>
          )}
        </>
      )}
      {simulation && (
        <NewAssignment
          {...p}
          busy={busy}
          submit={(data) =>
            action(async () => {
              const r = await save(
                "field_plan",
                String(data.label),
                data.data as Record<string, unknown>,
              );
              setSelected(r.id);
            })
          }
        />
      )}
    </div>
  );
}

function NewAssignment(
  p: Props & {
    busy: boolean;
    submit: (data: {
      label: string;
      data: Record<string, unknown>;
    }) => Promise<void>;
  },
) {
  const crew = (p.d.operations || []).filter(
    (r) => r.kind === "crew" && r.data.status === "on_duty",
  );
  const [assetId, setAssetId] = useState(p.d.assets[0]?.id || "");
  return (
    <details className="mission-details">
      <summary>Assign another crew member</summary>
      <p>
        Create a fictional work area for an existing on-duty roster member. Add
        people in People & operations first.
      </p>
      <form
        className="mission-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          p.submit({
            label: String(f.get("label")),
            data: {
              crew_id: String(f.get("crew")),
              asset_id: assetId,
              work_order_id: String(f.get("order")) || null,
              centre_x: Number(f.get("x")),
              centre_y: Number(f.get("y")),
              radius_m: Number(f.get("radius")),
              restricted_x: 390,
              restricted_y: 70,
              restricted_radius_m: 65,
              check_in_due: new Date(String(f.get("due"))).toISOString(),
              note: "Illustrative local work area, unsurveyed coordinates and restricted area. No live tracker is connected.",
            },
          });
        }}
      >
        <label>
          Task name
          <input name="label" required minLength={2} maxLength={150} />
        </label>
        <label>
          On-duty crew
          <select name="crew" required>
            <option value="">Choose a person</option>
            {crew.map((c) => (
              <option value={c.id} key={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Equipment
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            {p.d.assets.map((a) => (
              <option value={a.id} key={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Work order
          <select name="order" key={assetId}>
            <option value="">No linked work order</option>
            {p.d.work_orders
              .filter((w) => w.asset_id === assetId && w.status !== "resolved")
              .map((w) => (
                <option value={w.id} key={w.id}>
                  {w.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Area centre east (m)
          <input
            name="x"
            required
            type="number"
            min="-5000"
            max="5000"
            defaultValue="200"
          />
        </label>
        <label>
          Area centre north (m)
          <input
            name="y"
            required
            type="number"
            min="-5000"
            max="5000"
            defaultValue="0"
          />
        </label>
        <label>
          Assigned radius (m)
          <input
            name="radius"
            required
            type="number"
            min="20"
            max="3000"
            defaultValue="160"
          />
        </label>
        <label>
          Check-in due (local time)
          <input name="due" type="datetime-local" required />
        </label>
        <button
          disabled={
            !p.write ||
            !canWrite(p.role, "operations") ||
            p.busy ||
            !crew.length
          }
        >
          Create field assignment
        </button>
      </form>
    </details>
  );
}
