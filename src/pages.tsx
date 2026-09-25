import { ResponseComparison } from "./ResponseComparison";
import { ShipmentJourney } from "./LiveExercises";
import { FuelForecast } from "./Analysis";
import { ResupplyCoverage } from "./Operations";
import { randomId } from "./id";
import { PlanningAnalysis } from "./PlanningAnalysis";
import { Waste } from "./Waste";
import { AdminSetup } from "./AdminSetup";
import { useState, useEffect, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  AlertTriangle,
  Clock,
  Check,
  FlaskConical,
  Upload,
  ExternalLink,
  Package,
  Plus,
  FileText,
  Activity,
  Download,
} from "lucide-react";
import type {
  Snapshot,
  Asset,
  Page,
  ScenarioInputs,
  ScenarioResult,
} from "./types";
import {
  Badge,
  Panel,
  Stat,
  Notice,
  Empty,
  Trend,
  Modal,
  Evidence,
} from "./components";
import { energy, latest, n, date, calculate, affected } from "./model";
import { API, request, path, mutate, bearer } from "./api";
export interface Props {
  d: Snapshot;
  startGuide?: () => void;
  detail?: (kind: string, id: string) => void;
  scenario?: (inputs: ScenarioInputs) => void;
  go: (page: Page) => void;
  select: (a: Asset) => void;
  evidence: (ids: string[]) => void;
  investigate: (id: string) => void;
  write: boolean;
  refresh: () => void;
  notify: (s: string) => void;
  role: string;
  planningTarget: number;
  setPlanningTarget: (days: number) => void;
  focus: string;
  setFocus: (id: string) => void;
}
export { Overview } from "./Overview";
export function Energy(p: Props) {
  const e = energy(p.d);
  return (
    <>
      <div className="stats">
        <Stat
          label="Generation"
          value={e.gen?.value}
          unit="kW"
          sub="Latest recorded total"
          click={() => p.evidence(e.gen ? [e.gen.id] : [])}
        />
        <Stat
          label="Consumption"
          value={e.load?.value}
          unit="kW"
          sub="Latest recorded total"
          click={() => p.evidence(e.load ? [e.load.id] : [])}
        />
        <Stat
          label="Fuel available"
          value={e.fuel?.quantity}
          unit="L"
          sub="From the inventory ledger"
          click={() => p.go("logistics")}
        />
        <Stat
          label="Battery reserve"
          value={e.reserve}
          unit="kWh"
          sub="Nameplate × SoC · estimate"
          click={() => p.evidence(e.soc ? [e.soc.id] : [])}
        />
      </div>
      <div className="two-columns">
        <Panel
          title="Power balance"
          sub="Recorded totals; no inferred subsystem breakdown"
        >
          <Trend
            onEvidence={p.evidence}
            readings={p.d.measurements}
            metric="generation"
            second="consumption"
            title="Station power"
            unit="kW"
          />
        </Panel>
        <Panel title="How long can fuel last?" sub="An explainable estimate">
          <div className="autonomy">
            {n(e.autonomy)}
            <span>days at constant burn</span>
          </div>
          <div className="formula">
            <span>{n(e.fuel?.quantity, 0)} L stock</span>
            <b>÷</b>
            <span>{n(e.burn?.value, 0)} L/day burn</span>
          </div>
          <p>
            Uses current ledger balance and the latest historical burn input. It
            assumes consumption remains constant, with no reserves, leaks or
            delivery changes.
          </p>
          <div className="row">
            <button
              className="text-button"
              onClick={() =>
                p.evidence([
                  ...(e.burn ? [e.burn.id] : []),
                  ...(e.fuel ? [e.fuel.source_id] : []),
                ])
              }
            >
              Trace inputs <ArrowUpRight size={15} />
            </button>
            <button className="small-button" onClick={() => p.go("scenarios")}>
              Test a resupply delay
            </button>
          </div>
        </Panel>
      </div>
      <ResupplyCoverage {...p} />
      <FuelForecast {...p} />
      <PlanningAnalysis {...p} />
      <Panel
        title="Fuel consumption history"
        sub="L/day · latest input used by the autonomy model"
      >
        <Trend
          onEvidence={p.evidence}
          readings={p.d.measurements}
          metric="fuel_burn"
          title="Daily burn rate"
          unit="L/day"
        />
      </Panel>
      <Notice>
        Subsystem measurements are unavailable. Battery reserve excludes
        discharge limits, conversion losses and degradation. Capacity is an
        illustrative assumption.
      </Notice>
    </>
  );
}
export function Logistics(p: Props) {
  const [view, setView] = useState("inventory");
  return (
    <>
      <ShipmentJourney {...p} />
      <ResupplyCoverage {...p} />
      <div
        className="logistics-tabs segmented"
        role="group"
        aria-label="Logistics areas"
      >
        <button
          aria-pressed={view === "inventory"}
          onClick={() => setView("inventory")}
        >
          Inventory & shipments
        </button>
        <button
          aria-pressed={view === "waste"}
          onClick={() => setView("waste")}
        >
          Waste & retrograde
        </button>
      </div>
      {view === "inventory" ? <InventoryLogistics {...p} /> : <Waste {...p} />}
    </>
  );
}
function InventoryLogistics(p: Props) {
  const { d, write, notify, refresh } = p;
  const [itemId, setItem] = useState(""),
    [busy, setBusy] = useState(false);
  async function transaction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const kind = String(f.get("kind")),
        qty = Number(f.get("quantity"));
      await mutate(d.workspace, d.station, "/inventory/transactions", {
        item_id: itemId,
        delta: kind === "issue" ? -qty : qty,
        kind,
        reason: String(f.get("reason")),
        work_order_id: null,
        idempotency_key: randomId(),
      });
      setItem("");
      refresh();
      notify("Inventory transaction saved.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reorder(id: string) {
    try {
      await mutate(d.workspace, d.station, "/replenishments", {
        item_id: id,
        quantity: 12,
        idempotency_key: randomId(),
      });
      refresh();
      notify("Replenishment request saved for 12 units.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <Notice>
        Fuel stock is shared with energy planning. Receipts, issues and
        adjustments are recorded in one ledger.
      </Notice>
      <Panel
        title="Station inventory"
        sub="Quantities, storage locations and replenishment thresholds"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item / location</th>
                <th>Category</th>
                <th>Available</th>
                <th>Reorder at</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {d.inventory.map((i) => (
                <tr key={i.id}>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => p.evidence([i.source_id])}
                    >
                      {i.name}
                    </button>
                    <small>{i.location}</small>
                  </td>
                  <td>{i.category}</td>
                  <td className="quantity">
                    {n(i.quantity, 0)} <span>{i.unit}</span>
                    <small>
                      {n(
                        (d.reservations || [])
                          .filter(
                            (r) =>
                              r.item_id === i.id && r.status === "reserved",
                          )
                          .reduce((a, r) => a + r.remaining, 0),
                        0,
                      )}{" "}
                      allocated
                    </small>
                  </td>
                  <td>
                    {n(i.reorder_point, 0)} {i.unit}
                  </td>
                  <td>
                    <Badge
                      tone={i.quantity <= i.reorder_point ? "amber" : "teal"}
                    >
                      {i.quantity <= i.reorder_point
                        ? "Reorder needed"
                        : "Above threshold"}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="small-button"
                      disabled={!write}
                      onClick={() => setItem(i.id)}
                    >
                      Record movement
                    </button>
                    {i.quantity <= i.reorder_point && (
                      <button
                        className="text-button"
                        disabled={
                          !write ||
                          d.replenishments.some((r) => r.item_id === i.id)
                        }
                        onClick={() => reorder(i.id)}
                      >
                        {d.replenishments.some((r) => r.item_id === i.id)
                          ? "Requested"
                          : "Request 12 " + i.unit}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.inventory.length && <Empty />}
      </Panel>
      <div className="two-columns">
        <Panel
          title="Shipment manifests"
          sub="Arrival status never adds stock automatically"
        >
          {d.shipments.map((s) => (
            <div className="shipment" key={s.id}>
              <div className="row">
                <Package size={24} />
                <Badge tone="muted">{s.status}</Badge>
              </div>
              <h3>{s.name}</h3>
              <p>Expected arrival: {s.eta} · illustrative</p>
              {s.manifest.map((m) => (
                <div className="list-row" key={m.name}>
                  <span>{m.name}</span>
                  <strong>
                    {n(m.quantity, 0)} {m.unit}
                  </strong>
                </div>
              ))}
              <p className="muted">{s.risk}</p>
              <details>
                <summary>Status history</summary>
                {s.history.map((h, i) => (
                  <p key={i}>
                    {date(h.at)} · {h.status}
                    <br />
                    {h.note}
                  </p>
                ))}
              </details>
              {write && s.status !== "arrived" && (
                <button
                  className="small-button"
                  onClick={async () => {
                    try {
                      await mutate(
                        d.workspace,
                        d.station,
                        "/shipments/" + s.id,
                        {
                          status:
                            s.status === "planned"
                              ? "dispatched"
                              : s.status === "dispatched"
                                ? "in_transit"
                                : "arrived",
                          note: "Status advanced in the demonstration.",
                        },
                        "PATCH",
                      );
                      refresh();
                      notify("Shipment status saved. Stock is unchanged.");
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  Advance shipment status
                </button>
              )}
            </div>
          ))}
          {!d.shipments.length && <Empty />}
        </Panel>
        <Panel
          title="Inventory ledger"
          sub="Most recent 12 transactions · opening balances included"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time / item</th>
                  <th>Change</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {[...d.ledger]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .slice(0, 12)
                  .map((l) => (
                    <tr key={l.id}>
                      <td>
                        {d.inventory.find((i) => i.id === l.item_id)?.name}
                        <small>{date(l.created_at)}</small>
                      </td>
                      <td className={l.delta < 0 ? "amber-text" : "teal-text"}>
                        {l.delta > 0 ? "+" : ""}
                        {n(l.delta, 0)}
                        <small>Balance {n(l.balance, 0)}</small>
                      </td>
                      <td>
                        {l.reason}
                        {l.work_order_id && <small>Linked work order</small>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      {itemId && (
        <Modal title="Record inventory movement" onClose={() => setItem("")}>
          <form onSubmit={transaction}>
            <label>
              Movement type
              <select name="kind">
                <option value="receipt">Receipt · increase stock</option>
                <option value="issue">Issue · decrease stock</option>
              </select>
            </label>
            <label>
              Quantity
              <input
                type="number"
                name="quantity"
                min="0.001"
                step={
                  d.inventory.find((i) => i.id === itemId)?.unit === "L"
                    ? "any"
                    : "1"
                }
                required
              />
            </label>
            <label>
              Reason
              <input
                name="reason"
                minLength={5}
                maxLength={500}
                required
                placeholder="Reference receipt or explain the issue"
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save transaction"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Maintenance(p: Props & { incidentId?: string }) {
  const { d, write, refresh, notify } = p,
    [alertId, setAlert] = useState(""),
    [resolveId, setResolve] = useState(""),
    [busy, setBusy] = useState(false);
  async function act(
    endpoint: string,
    body: Record<string, unknown> = {},
    method = "POST",
  ) {
    setBusy(true);
    try {
      await mutate(d.workspace, d.station, endpoint, body, method);
      refresh();
      notify("Saved. Sensor recovery remains a separate state.");
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!p.incidentId && (
        <div className="workflow-strip">
          {[
            "Measurement",
            "Rule evaluation",
            "Alert",
            "Acknowledgement",
            "Work order",
            "Spare use",
            "Resolution",
          ].map((x, i) => (
            <span key={x}>
              {i > 0 && <ArrowRight size={14} />}
              <b>{String(i + 1).padStart(2, "0")}</b>
              {x}
            </span>
          ))}
        </div>
      )}
      <Panel
        title="Alerts"
        sub="Suspected causes require inspection; recovery follows readings"
      >
        <div className="alert-list">
          {d.alerts
            .filter((a) => !p.incidentId || a.id === p.incidentId)
            .map((a) => (
              <div className="alert-row" key={a.id}>
                <div
                  className={"alert-icon " + (a.recovered ? "teal" : "amber")}
                >
                  <AlertTriangle size={23} />
                </div>
                <div className="grow">
                  <div className="row start">
                    <h3>{a.title}</h3>
                    <Badge tone={a.recovered ? "teal" : "amber"}>
                      {a.recovered ? "Sensor recovered" : "Sensor unrecovered"}
                    </Badge>
                  </div>
                  <p>
                    {a.status} · Triggered by consecutive samples · Rule
                    assumption applies
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      p.incidentId
                        ? p.evidence([a.measurement_id])
                        : p.investigate(a.id)
                    }
                  >
                    {p.incidentId
                      ? "View triggering evidence"
                      : "Investigate incident"}{" "}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="actions">
                  {a.status === "open" ? (
                    <button
                      className="small-button"
                      disabled={!write || busy}
                      onClick={() => act("/alerts/" + a.id + "/acknowledge")}
                    >
                      Acknowledge
                    </button>
                  ) : d.work_orders.some((w) => w.alert_id === a.id) ? (
                    <Badge tone="muted">Work order linked</Badge>
                  ) : (
                    <button
                      className="primary small"
                      disabled={!write || busy}
                      onClick={() => setAlert(a.id)}
                    >
                      Create work order
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
        {!d.alerts.length && (
          <Empty title="No alert records">
            No sensor connection means absence of alerts is not proof of safe
            conditions.
          </Empty>
        )}
      </Panel>
      <Panel
        title="Maintenance workbench"
        sub="Assignments, spares, resolution notes and audit history"
      >
        {d.work_orders.some(
          (w) => !p.incidentId || w.alert_id === p.incidentId,
        ) ? (
          <div className="work-orders">
            {d.work_orders
              .filter((w) => !p.incidentId || w.alert_id === p.incidentId)
              .map((w) => (
                <div className="work-order" key={w.id}>
                  <div className="row">
                    <span className="mono">
                      WO-{w.id.slice(0, 6).toUpperCase()}
                    </span>
                    <Badge tone={w.status === "resolved" ? "teal" : "ice"}>
                      {w.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <h3>{w.title}</h3>
                  <p>{w.diagnosis}</p>
                  <dl>
                    <dt>Assigned to</dt>
                    <dd>{w.assignee}</dd>
                    <dt>Due</dt>
                    <dd>{w.due_date}</dd>
                    <dt>Priority</dt>
                    <dd>{w.priority}</dd>
                  </dl>
                  {w.resolution && (
                    <div className="resolution">
                      <Check size={16} />
                      {w.resolution}
                    </div>
                  )}
                  <div className="actions">
                    {w.status !== "resolved" && (
                      <button
                        className="small-button"
                        disabled={
                          !write ||
                          busy ||
                          !!d.reservations?.some(
                            (r) =>
                              r.work_order_id === w.id &&
                              r.idempotency_key === "allocate-" + w.id,
                          )
                        }
                        onClick={() => {
                          const asset = d.assets.find(
                            (a) => a.id === w.asset_id,
                          );
                          const item = d.inventory.find(
                            (i) =>
                              i.asset_code === asset?.code &&
                              i.category === "spare",
                          );
                          if (item)
                            act("/reservations", {
                              item_id: item.id,
                              work_order_id: w.id,
                              quantity: 1,
                              idempotency_key: "allocate-" + w.id,
                            });
                          else notify("No compatible spare registered.");
                        }}
                      >
                        Allocate 1 coolant filter
                      </button>
                    )}
                    {d.reservations
                      ?.filter((r) => r.work_order_id === w.id)
                      .map((r) => (
                        <span key={r.id} className="actions">
                          <Badge tone="muted">
                            Spare {r.status} · {r.remaining} remaining
                          </Badge>
                          {r.status === "reserved" && (
                            <button
                              className="small-button"
                              disabled={!write || busy}
                              onClick={() =>
                                act("/reservations/" + r.id + "/release", {})
                              }
                            >
                              Release allocation
                            </button>
                          )}
                        </span>
                      ))}
                    {w.status === "open" && (
                      <button
                        className="small-button"
                        disabled={!write || busy}
                        onClick={() =>
                          act(
                            "/work-orders/" + w.id,
                            { status: "in_progress" },
                            "PATCH",
                          )
                        }
                      >
                        Start work
                      </button>
                    )}
                    {w.status === "in_progress" && (
                      <>
                        <button
                          className="small-button"
                          disabled={!write || busy}
                          onClick={() => {
                            const i = d.inventory.find(
                              (i) =>
                                i.asset_code === "GEN-A" &&
                                i.category === "spare",
                            );
                            if (i)
                              act("/inventory/transactions", {
                                item_id: i.id,
                                delta: -1,
                                kind: "spare_use",
                                reason:
                                  "Coolant filter used for generator inspection",
                                work_order_id: w.id,
                                idempotency_key: "spare-" + w.id,
                              });
                          }}
                        >
                          Use 1 coolant filter
                        </button>
                        <button
                          className="primary small"
                          disabled={!write || busy}
                          onClick={() => setResolve(w.id)}
                        >
                          Resolve with notes
                        </button>
                      </>
                    )}
                    {API && write && (
                      <label className="attachment-button">
                        Attach evidence
                        <input
                          type="file"
                          accept=".pdf,.txt,.md,.csv"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const form = new FormData();
                            form.append("file", f);
                            try {
                              await request(
                                path(d.workspace, d.station) +
                                  "/work-orders/" +
                                  w.id +
                                  "/attachments",
                                form,
                              );
                              refresh();
                              notify("Attachment saved.");
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {d.attachments
                    .filter((a) => a.work_order_id === w.id)
                    .map((a) => (
                      <p key={a.id}>
                        <FileText size={14} />
                        {a.filename}
                      </p>
                    ))}
                </div>
              ))}
          </div>
        ) : (
          <Empty title="No work orders yet">
            Acknowledge an alert and assign its first maintenance action.
          </Empty>
        )}
      </Panel>
      <Panel
        title="Audit trail"
        sub="Consequential actions and independent recovery events"
      >
        <div className="audit-list">
          {[...d.audit]
            .filter(
              (a) =>
                !p.incidentId ||
                a.entity_id === p.incidentId ||
                d.work_orders.some(
                  (w) => w.alert_id === p.incidentId && w.id === a.entity_id,
                ) ||
                d.ledger.some(
                  (l) =>
                    l.id === a.entity_id &&
                    d.work_orders.some(
                      (w) =>
                        w.id === l.work_order_id && w.alert_id === p.incidentId,
                    ),
                ) ||
                d.reservations?.some(
                  (r) =>
                    r.id === a.entity_id &&
                    d.work_orders.some(
                      (w) =>
                        w.id === r.work_order_id && w.alert_id === p.incidentId,
                    ),
                ),
            )
            .reverse()
            .slice(0, 20)
            .map((a) => (
              <div className="audit-row" key={a.id}>
                <Activity size={16} />
                <div>
                  <strong>{a.action.replaceAll("_", " ")}</strong>
                  <small>
                    {date(a.created_at)} ·{" "}
                    {a.actor === "seed-v1"
                      ? "Demonstration initializer"
                      : a.actor.slice(0, 32)}
                  </small>
                  {a.details.notes != null && <p>{String(a.details.notes)}</p>}
                </div>
              </div>
            ))}
        </div>
      </Panel>
      {alertId && (
        <Modal title="Assign maintenance work" onClose={() => setAlert("")}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act("/alerts/" + alertId + "/work-orders", {
                  assignee: f.get("assignee"),
                  priority: f.get("priority"),
                  due_date: f.get("due_date"),
                })
              )
                setAlert("");
            }}
          >
            <label>
              Responsible person
              <input
                name="assignee"
                defaultValue="Station engineer"
                required
                maxLength={100}
              />
            </label>
            <label>
              Priority
              <select name="priority">
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              Due date
              <input
                type="date"
                name="due_date"
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              Create work order
            </button>
          </form>
        </Modal>
      )}
      {resolveId && (
        <Modal title="Resolve maintenance work" onClose={() => setResolve("")}>
          <Notice>
            Closing work does not mark the sensor recovered. A qualifying new
            reading must recover it.
          </Notice>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act(
                  "/work-orders/" + resolveId,
                  { status: "resolved", notes: f.get("notes") },
                  "PATCH",
                )
              )
                setResolve("");
            }}
          >
            <label>
              Work performed and evidence
              <textarea
                name="notes"
                required
                minLength={10}
                maxLength={3000}
                placeholder="What was inspected, what changed, and what remains uncertain?"
              />
            </label>
            <button className="primary" disabled={busy}>
              Save resolution
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Environment(p: Props) {
  const [environmentEvidence, setEnvironmentEvidence] = useState<
    string[] | null
  >(null);
  const [mode, setMode] = useState("simulation"),
    [replay, setReplay] = useState(24),
    [provider, setProvider] = useState<Snapshot | null>(null);
  useEffect(() => {
    fetch("/provider-sample.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setProvider)
      .catch(() => setProvider(null));
  }, []);
  const sampled =
    mode === "provider" && p.d.station === "maitri" ? provider : p.d;
  const rows =
    mode === "provider" && p.d.station !== "maitri"
      ? []
      : (
          sampled?.measurements.filter(
            (m) =>
              m.metric === "temperature" &&
              (mode === "provider" ? m.origin === "reanalysis" : true),
          ) || []
        ).sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  const index = Math.min(replay, Math.max(0, rows.length - 1)),
    cursor = rows[index]?.observed_at;
  const readings = (sampled?.measurements || []).filter(
    (m) =>
      (!cursor || m.observed_at <= cursor) &&
      (mode === "provider" ? m.origin === "reanalysis" : true),
  );
  return (
    <>
      <div className="toolbar">
        <div
          className="segmented"
          role="group"
          aria-label="Environment data source"
        >
          <button
            className={mode === "simulation" ? "active" : ""}
            onClick={() => {
              setMode("simulation");
              setReplay(24);
            }}
          >
            Workspace readings
          </button>
          <button
            className={mode === "provider" ? "active" : ""}
            onClick={() => {
              setMode("provider");
              setReplay(6);
            }}
          >
            NASA POWER sample
          </button>
        </div>
        <Badge tone="muted">Historical replay · never live</Badge>
      </div>
      <Notice>
        {mode === "provider"
          ? "NASA POWER / MERRA-2 · 1–7 January 2024 · daily UTC grid means near Maitri. These are model estimates, not station sensor observations."
          : p.d.workspace === "operational"
            ? "Workspace records retain their origin and historical observation times. Missing values remain gaps."
            : "Demonstration readings are synthetic. Missing values appear as gaps; advancing the replay changes the displayed time, not the origin of the data."}
      </Notice>
      <Panel
        title="Environmental record"
        sub={
          mode === "provider"
            ? "Historical gridded reanalysis · approximately 0.5° × 0.625°"
            : "Historical workspace telemetry"
        }
        action={
          <button
            className="text-button"
            disabled={!rows.length}
            onClick={() =>
              setEnvironmentEvidence(rows[index] ? [rows[index].id] : [])
            }
          >
            Source details <ArrowUpRight size={14} />
          </button>
        }
      >
        {rows.length ? (
          <>
            <div className="replay">
              <Clock size={18} />
              <strong>{date(cursor)}</strong>
              <label className="grow">
                Replay position
                <input
                  aria-label="Historical replay position"
                  type="range"
                  min="0"
                  max={rows.length - 1}
                  value={index}
                  onChange={(e) => setReplay(Number(e.target.value))}
                />
              </label>
              <span>
                {index + 1} / {rows.length}
              </span>
            </div>
            <Trend
              onEvidence={setEnvironmentEvidence}
              readings={readings}
              metric="temperature"
              title="Air temperature"
              unit="°C"
            />
          </>
        ) : (
          <Empty title="No readings for this source and station">
            The retrieved sample covers the grid near Maitri. No Bharati sample
            has been substituted.
          </Empty>
        )}
      </Panel>
      <div className="two-columns">
        <Panel
          title="Wind speed"
          sub={
            mode === "provider"
              ? "Model wind at 10 m above grid elevation"
              : "Illustrative hourly wind measurements"
          }
        >
          <Trend
            onEvidence={setEnvironmentEvidence}
            readings={readings}
            metric="wind_speed"
            title="Wind speed"
            unit="m/s"
          />
        </Panel>
        <Panel title="Source and quality guide">
          <dl className="classification">
            <dt>Observation</dt>
            <dd>
              A station or instrument reading; verification is tracked
              separately.
            </dd>
            <dt>Reanalysis</dt>
            <dd>
              A model estimate informed by observations over a geographic grid.
            </dd>
            <dt>Forecast</dt>
            <dd>
              A prediction for a future valid time. No forecast feed is
              connected.
            </dd>
            <dt>Simulation</dt>
            <dd>Project-generated examples for testing and demonstration.</dd>
          </dl>
          <Notice tone="amber">
            Historical records cannot establish current weather or equipment
            conditions.
          </Notice>
        </Panel>
      </div>
      {environmentEvidence && sampled && (
        <Modal
          title="Environmental evidence"
          onClose={() => setEnvironmentEvidence(null)}
        >
          <Evidence d={sampled} ids={environmentEvidence} />
        </Modal>
      )}
    </>
  );
}
const defaults: ScenarioInputs = {
  failure: "generator",
  demand_increase: 0,
  shed_kw: 0,
  delay_days: 14,
  backup_kw: 180,
};
export function Scenarios(p: Props & { initial?: ScenarioInputs }) {
  const [v, setV] = useState<ScenarioInputs>(p.initial || defaults),
    [result, setResult] = useState<ScenarioResult | null>(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<
      {
        station: string;
        workspace?: string;
        name: string;
        result: ScenarioResult;
      }[]
    >(() => JSON.parse(sessionStorage.getItem("polaris-scenarios") || "[]"));
  useEffect(() => {
    if (p.initial) {
      setV(p.initial);
      setResult(null);
    }
  }, [p.initial]);
  const e = energy(p.d);
  const change = (k: keyof ScenarioInputs, value: string | number) => {
    setV((x) => ({ ...x, [k]: value }));
    setResult(null);
  };
  async function run() {
    setBusy(true);
    try {
      const r = API
        ? await request(path(p.d.workspace, p.d.station) + "/scenarios", v)
        : calculate(p.d, v);
      setResult(r);
    } catch (e) {
      p.notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const failedCode = (
      {
        generator: "GEN-A",
        communications: "COMMS",
        heating: "HVAC",
        weather: "HVAC",
      } as Record<string, string>
    )[v.failure],
    failed = p.d.assets.find((a) => a.code === failedCode);
  return (
    <>
      <ResponseComparison {...p} />
      <Notice>
        Isolated what-if analysis. Inputs and results do not change telemetry,
        stock, alerts or work orders. Capacity scenarios below are saved only in
        this browser tab. Named fuel comparisons above are saved in the selected
        workspace.
      </Notice>
      <div className="scenario-layout">
        <Panel
          title="Define a scenario"
          sub="Explicit inputs · repeatable calculations"
        >
          <label>
            Disruption
            <select
              value={v.failure}
              onChange={(e) => change("failure", e.target.value)}
            >
              <option value="generator">Primary generator failure</option>
              <option value="communications">Loss of communications</option>
              <option value="heating">Heating degradation</option>
              <option value="weather">Severe weather assumption</option>
              <option value="none">Demand / resupply change only</option>
            </select>
          </label>
          {[
            ["demand_increase", "Additional electrical demand", "%", 0, 100],
            ["shed_kw", "Discretionary load shedding", "kW", 0, 150],
            ["delay_days", "Planning horizon from baseline", "days", 0, 365],
            ["backup_kw", "Assumed backup capacity", "kW", 0, 300],
          ].map(([key, label, unit, min, max]) => (
            <label key={key}>
              <span className="row">
                <span>{label}</span>
                <strong>
                  {v[key as keyof ScenarioInputs]} {unit}
                </strong>
              </span>
              <input
                aria-label={String(label)}
                type="range"
                value={v[key as keyof ScenarioInputs]}
                min={Number(min)}
                max={Number(max)}
                onChange={(e) =>
                  change(key as keyof ScenarioInputs, Number(e.target.value))
                }
              />
            </label>
          ))}
          <button className="primary full" onClick={run} disabled={busy}>
            <FlaskConical size={17} />
            {busy ? "Calculating…" : "Run scenario"}
          </button>
          <p className="muted small-copy">
            Linear resource model v1. No automatic control actions.
          </p>
        </Panel>
        <div>
          <Panel
            title="Baseline → scenario"
            sub="Resource implications and capacity constraints"
            action={
              result?.available && (
                <button
                  className="small-button"
                  onClick={() => {
                    const next = [
                      ...saved,
                      {
                        station: p.d.station,
                        workspace: p.d.workspace,
                        name: `${v.failure} / ${v.delay_days}d`,
                        result,
                      },
                    ].slice(-4);
                    setSaved(next);
                    sessionStorage.setItem(
                      "polaris-scenarios",
                      JSON.stringify(next),
                    );
                    p.notify("Comparison saved in this browser tab.");
                  }}
                >
                  Save comparison
                </button>
              )
            }
          >
            {result?.available ? (
              <>
                <div className="comparison">
                  <div>
                    <span>Baseline demand</span>
                    <strong>
                      {n(e.load?.value)} <small>kW</small>
                    </strong>
                  </div>
                  <ArrowRight size={24} />
                  <div>
                    <span>Scenario demand</span>
                    <strong>
                      {n(result.demand_kw)} <small>kW</small>
                    </strong>
                  </div>
                </div>
                <div className="scenario-results">
                  <div>
                    <span>Power shortfall</span>
                    <strong
                      className={result.deficit_kw ? "amber-text" : "teal-text"}
                    >
                      {n(result.deficit_kw)} <small>kW</small>
                    </strong>
                  </div>
                  <div>
                    <span>Estimated fuel autonomy</span>
                    <strong>
                      {n(result.autonomy_days)} <small>days</small>
                    </strong>
                  </div>
                  <div>
                    <span>Fuel at delay horizon</span>
                    <strong
                      className={
                        (result.delay_reserve_litres ?? 0) < 0
                          ? "amber-text"
                          : ""
                      }
                    >
                      {n(result.delay_reserve_litres, 0)} <small>L</small>
                    </strong>
                  </div>
                </div>
                {(result.deficit_kw ?? 0) > 0 && (
                  <Notice tone="amber">
                    Demand exceeds assumed available supply. Inspect backup
                    readiness and consider discretionary load shedding.
                  </Notice>
                )}
                <h3>Calculation assumptions</h3>
                <ul className="assumptions">
                  {result.assumptions?.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <details>
                  <summary>Formula and input record IDs</summary>
                  <p>
                    Demand = max(0, baseline demand × demand factor − shed
                    load). Burn = baseline burn × demand / baseline demand.
                    Autonomy = fuel / burn.
                  </p>
                  <p className="mono">{result.lineage?.join(", ")}</p>
                </details>
              </>
            ) : (
              <Empty title={result?.reason || "Ready to compare"}>
                Choose an assumption, then run the deterministic model.
              </Empty>
            )}
          </Panel>
          <Panel
            title="Potential dependency exposure"
            sub="Graph reachability does not prove a failure will propagate"
          >
            {failed ? (
              <>
                <div className="row start">
                  <Badge tone="amber">{failed.name}</Badge>
                  <ArrowRight size={18} />
                </div>
                <div className="dependency-chips">
                  {affected(p.d, failed.id).map((a) => (
                    <button
                      className="chip"
                      key={a.id}
                      onClick={() => p.select(a)}
                    >
                      {a.name}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
                <p className="muted">
                  Alternate supplies and actual failover behaviour require
                  engineering validation.
                </p>
              </>
            ) : (
              <p>No asset disruption selected.</p>
            )}
          </Panel>
        </div>
      </div>
      {saved.some(
        (s) => s.station === p.d.station && s.workspace === p.d.workspace,
      ) && (
        <Panel title="Saved comparisons" sub="This tab only · same station">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Demand</th>
                  <th>Shortfall</th>
                  <th>Autonomy</th>
                  <th>Fuel remaining</th>
                </tr>
              </thead>
              <tbody>
                {saved
                  .filter(
                    (s) =>
                      s.station === p.d.station &&
                      s.workspace === p.d.workspace,
                  )
                  .map((s, i) => (
                    <tr key={i}>
                      <td>{s.name}</td>
                      <td>{n(s.result.demand_kw)} kW</td>
                      <td>{n(s.result.deficit_kw)} kW</td>
                      <td>{n(s.result.autonomy_days)} d</td>
                      <td>{n(s.result.delay_reserve_litres, 0)} L</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
export function DataPage(p: Props) {
  const [register, setRegister] = useState<
      {
        title: string;
        provider: string;
        url: string;
        classification: string;
        retrieval: string;
        coverage: string;
        terms: string;
      }[]
    >([]),
    [preview, setPreview] = useState<{
      id: string;
      rows: unknown[];
      errors: { row: number; message: string }[];
      status: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/source-register.json")
      .then((r) => r.json())
      .then(setRegister)
      .catch(() => {});
  }, []);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await request(
        path(p.d.workspace, p.d.station) + "/imports/preview",
        new FormData(e.currentTarget),
      );
      setPreview(r);
      p.refresh();
    } catch (e) {
      p.notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const allowed =
    !!API && p.role === "administrator" && p.d.workspace === "operational";
  return (
    <>
      <div className="two-columns">
        <Panel
          title="Evidence in this workspace"
          sub="Origin, processing and verification are separate fields"
        >
          {p.d.sources.map((s) => (
            <button
              className="source-card"
              key={s.id}
              onClick={() => p.evidence([s.id])}
            >
              <div className="row">
                <DatabaseIcon />
                <Badge tone={s.origin === "simulation" ? "muted" : "teal"}>
                  {s.origin}
                </Badge>
              </div>
              <h3>{s.title}</h3>
              <p>
                {s.provider} · {s.verification}
              </p>
              <span>
                Inspect source lineage <ArrowUpRight size={14} />
              </span>
            </button>
          ))}
          {!p.d.sources.length && <Empty />}
        </Panel>
        <Panel
          title="Provider connector"
          sub="NASA POWER daily grid data · bounded historical request"
        >
          <h3>Temperature and wind · January 2024</h3>
          <p>
            Retrieves seven daily UTC means near the selected station. Preserves
            the response, checksum, parser version and attribution. Caches each
            attempt for 24 hours.
          </p>
          <Notice>
            Gridded reanalysis remains distinct from station observations. No
            infrastructure or fuel provider is connected.
          </Notice>
          <button
            className="primary"
            disabled={!allowed || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await request(
                  path(p.d.workspace, p.d.station) + "/provider/nasa-power",
                  {},
                );
                p.refresh();
                p.notify(r.status + ": " + r.detail);
              } catch (e) {
                p.notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Retrieve provider data
          </button>
          <p className="muted small-copy">
            Requires administrator access to the connected operational
            workspace.
          </p>
          {p.d.acquisitions.map((a) => (
            <div className="record" key={a.id}>
              <Badge tone={a.status === "failed" ? "amber" : "teal"}>
                {a.status}
              </Badge>
              <p>{a.detail}</p>
              <small>{date(a.acquired_at)}</small>
            </div>
          ))}
        </Panel>
      </div>
      <Panel
        title="Administrator CSV import"
        sub="Preview → validate every row → commit atomically"
      >
        <Notice>
          Uploaded files remain unverified. Originals are retained even when
          validation rejects the rows.
        </Notice>
        <form className="import-form" onSubmit={upload}>
          <label>
            Dataset title
            <input
              name="title"
              required
              minLength={3}
              maxLength={200}
              disabled={!allowed}
            />
          </label>
          <label>
            Source evidence / usage rights
            <input
              name="evidence"
              required
              minLength={5}
              maxLength={1000}
              placeholder="Dataset URL, instrument log or document reference"
              disabled={!allowed}
            />
          </label>
          <label>
            Declared origin
            <select name="origin" disabled={!allowed}>
              <option value="observation">Observation · unverified</option>
              <option value="manual_entry">Manual entry · unverified</option>
              <option value="reanalysis">Reanalysis · unverified</option>
              <option value="forecast">Forecast · unverified</option>
            </select>
          </label>
          <label>
            CSV file · max 2 MB / 1000 rows
            <input
              type="file"
              name="file"
              accept=".csv"
              required
              disabled={!allowed}
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={!allowed || busy}>
              <Upload size={16} />
              {busy ? "Validating…" : "Preview import"}
            </button>
            <a className="small-button" href="/import-template.csv" download>
              Download schema example <Download size={15} />
            </a>
          </div>
        </form>
        {!allowed && (
          <p className="muted">
            Administrator sign-in and a connected backend are required to
            preserve files and import records.
          </p>
        )}
        {preview && (
          <div className="record">
            <div className="row">
              <h3>{preview.rows.length} valid rows</h3>
              <Badge tone={preview.errors.length ? "amber" : "teal"}>
                {preview.status}
              </Badge>
            </div>
            {preview.errors.map((e, i) => (
              <p className="amber-text" key={i}>
                Row {e.row}: {e.message}
              </p>
            ))}
            <pre>{JSON.stringify(preview.rows.slice(0, 5), null, 2)}</pre>
            <button
              className="primary"
              disabled={
                !!preview.errors.length || preview.status !== "preview" || busy
              }
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await request(
                    path(p.d.workspace, p.d.station) +
                      "/imports/" +
                      preview.id +
                      "/commit",
                    {},
                  );
                  setPreview(r);
                  p.refresh();
                  p.notify("Import committed atomically.");
                } catch (e) {
                  p.notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Commit validated rows
            </button>
          </div>
        )}
        <details>
          <summary>Supported schema and missing values</summary>
          <code>station,asset_code,metric,value,unit,observed_at</code>
          <p>
            Use maitri or bharati, a registered asset code, explicit timezone,
            and canonical units. Empty value means unavailable. NaN, infinity,
            duplicates and mismatched stations are rejected.
          </p>
          <p>
            Units: temperature / coolant_temperature = degC; generation /
            consumption = kW; fuel_burn = L/day; wind_speed = m/s; soc /
            humidity = %; pressure = hPa.
          </p>
        </details>
        {allowed && (
          <details>
            <summary>Register an asset before importing</summary>
            <form
              className="import-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await request(path(p.d.workspace, p.d.station) + "/assets", {
                    code: f.get("code"),
                    name: f.get("name"),
                    kind: f.get("kind"),
                  });
                  p.refresh();
                  p.notify("Asset registered.");
                } catch (e) {
                  p.notify((e as Error).message);
                }
              }}
            >
              <label>
                Code
                <input
                  name="code"
                  pattern="[A-Z0-9-]{1,20}"
                  defaultValue="ENV"
                  required
                />
              </label>
              <label>
                Name
                <input
                  name="name"
                  defaultValue="Station environment monitor"
                  required
                />
              </label>
              <label>
                Type
                <select name="kind">
                  {[
                    "environment",
                    "generator",
                    "fuel",
                    "distribution",
                    "battery",
                    "heating",
                    "water",
                    "communications",
                    "load",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <button className="small-button">Register asset</button>
            </form>
          </details>
        )}
      </Panel>
      {allowed && <AdminSetup {...p} />}
      <Panel
        title="Data-source register"
        sub="Research findings and acquisition status · checked 7 September 2026"
      >
        {register.map((s, i) => (
          <div className="register-row" key={i}>
            <div>
              <h3>{s.title}</h3>
              <p>
                {s.provider} · {s.coverage}
              </p>
              <p>
                <strong>Retrieval:</strong> {s.retrieval}
              </p>
              <p>
                <strong>Usage terms:</strong> {s.terms}
              </p>
              <a href={s.url} target="_blank" rel="noreferrer">
                Dataset-specific reference <ExternalLink size={13} />
              </a>
            </div>
            <Badge tone={s.classification === "reanalysis" ? "teal" : "muted"}>
              {s.classification}
            </Badge>
          </div>
        ))}
      </Panel>
      <Panel title="Preserved provider evidence">
        <p>
          The original NASA response and acquisition manifest document the
          actual historical retrieval. Test results do not authenticate source
          data.
        </p>
        <div className="actions">
          <a
            className="small-button"
            href="/evidence/nasa-power-maitri-20240101-20240107.json"
            download
          >
            Original NASA response <Download size={15} />
          </a>
          <a
            className="small-button"
            href="/evidence/acquisition-manifest.json"
            download
          >
            Checksum & acquisition manifest <Download size={15} />
          </a>
        </div>
      </Panel>
    </>
  );
}
function DatabaseIcon() {
  return <FileText size={24} />;
}
