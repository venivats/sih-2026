import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Play,
  MapPin,
  AlertTriangle,
  BookOpen,
  Check,
} from "lucide-react";
import type { Props } from "./pages";
import { Panel, Badge, Notice } from "./components";
import { energy, date, n } from "./model";
import { weather } from "./operationsModel";
import { zoneStatus, positionFor, checkInStatus } from "./missionModel";
import { Explanation } from "./Explanation";
export function MissionBrief(p: Props) {
  const { d } = p,
    e = energy(d),
    alerts = d.alerts.filter(
      (a) =>
        !a.recovered ||
        !d.work_orders.some(
          (w) => w.alert_id === a.id && w.status === "resolved",
        ),
    ),
    work = d.work_orders.filter((w) => w.status !== "resolved"),
    tasks = (d.operations || []).filter(
      (r) => r.kind === "outdoor_task" && r.data.status !== "completed",
    ),
    contacts = (d.operations || []).filter(
      (r) => r.kind === "contact" && r.data.status === "planned",
    ),
    plans = (d.operations || []).filter((r) => r.kind === "field_plan"),
    wind = weather(d);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);
  const fieldIssues = plans.filter(
    (r) =>
      zoneStatus(r, positionFor(d, r), clock).state !== "inside" ||
      checkInStatus(d, r, clock).overdue ||
      checkInStatus(d, r, clock).sos,
  );
  const scheduled = [
    ...tasks.map((r) => ({
      id: r.id,
      label: r.label,
      at: r.data.scheduled_at,
      owner:
        d.operations?.find((c) => c.id === r.data.assignee_id)?.label ||
        "Unassigned",
      page: "operations" as const,
    })),
    ...contacts.map((r) => ({
      id: r.id,
      label: r.label,
      at: r.data.starts_at,
      owner:
        d.operations?.find((c) => c.id === r.data.assignee_id)?.label ||
        "Unassigned",
      page: "operations" as const,
    })),
    ...d.shipments
      .filter((s) => s.status !== "arrived")
      .map((s) => ({
        id: s.id,
        label: s.name,
        at: s.eta,
        owner: "Shipment record",
        page: "logistics" as const,
      })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return (
    <div className="mission-brief">
      <div className="mission-heading">
        <div>
          <span className="eyebrow">STATION BRIEFING</span>
          <h2>What needs your attention?</h2>
          <p>
            {d.workspace === "operational"
              ? "Review the latest available records before selecting an action."
              : "Demonstration records: practise a complete response in an isolated workspace."}
          </p>
        </div>
        <button
          className="primary"
          onClick={p.startGuide}
          disabled={!navigator.onLine}
        >
          <Play size={17} /> Explore a station incident
        </button>
      </div>
      <div className="brief-metrics">
        <div>
          <strong>{alerts.length}</strong>
          <span>Incidents to review</span>
        </div>
        <div>
          <strong>{work.length}</strong>
          <span>Unresolved work orders</span>
        </div>
        <div>
          <strong>{fieldIssues.length}</strong>
          <span>Field assignments to review</span>
        </div>
        <div>
          <strong>{e.autonomy === null ? "—" : n(e.autonomy)}</strong>
          <span>Calculated fuel days</span>
        </div>
      </div>
      <div className="briefing-grid">
        <Panel
          title="Decisions needed"
          sub="Each item opens its evidence or related work"
        >
          {!alerts.length && !fieldIssues.length && (
            <Notice>
              No unresolved alert records. Missing telemetry does not establish
              normal station conditions.
            </Notice>
          )}
          {alerts.slice(0, 3).map((a) => {
            const order = d.work_orders.find((w) => w.alert_id === a.id);
            return (
              <button
                className="briefing-item"
                key={a.id}
                onClick={() => p.investigate(a.id)}
              >
                <AlertTriangle size={19} />
                <span>
                  <strong>{a.title}</strong>
                  <small>
                    {a.recovered
                      ? "Recovery reading recorded"
                      : "Sensor remains unrecovered"}{" "}
                    ·{" "}
                    {order
                      ? "Owner: " + order.assignee
                      : "No work owner assigned"}
                  </small>
                  <small>
                    {order
                      ? "Review work and resolution evidence"
                      : "Next: inspect the trigger, acknowledge and assign work"}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            );
          })}
          {alerts.length > 3 && (
            <button className="text-button" onClick={() => p.go("maintenance")}>
              View all {alerts.length} alerts
            </button>
          )}
          {!!fieldIssues.length && (
            <button className="briefing-item" onClick={() => p.go("field")}>
              <MapPin size={19} />
              <span>
                <strong>
                  {fieldIssues.length} field assignment(s) need review
                </strong>
                <small>
                  Inspect zone classification, position age and check-ins.
                </small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          )}
        </Panel>
        <Panel
          title="Next registered activities"
          sub="Record dates are shown explicitly; historical plans are not current instructions"
        >
          {scheduled.slice(0, 3).map((s) => (
            <button
              key={s.id}
              className="briefing-item"
              onClick={() =>
                s.page === "logistics"
                  ? p.detail?.("shipments", s.id)
                  : p.go(s.page)
              }
            >
              <span>
                <strong>{s.label}</strong>
                <small>{date(s.at)}</small>
                <small>{s.owner}</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
          {!scheduled.length && (
            <p>No activities or shipments have been registered.</p>
          )}
          <button className="text-button" onClick={() => p.go("operations")}>
            Plan duty, work and contacts
          </button>
        </Panel>
      </div>
      <div className="briefing-grid">
        <Panel title="Information to verify">
          <p>
            <strong>Outdoor work:</strong> {wind.reason}
          </p>
          <p>
            <strong>Equipment model:</strong> registered relationships are
            illustrative until reviewed against station documentation.
          </p>
          <button onClick={() => p.go("evidence")}>
            Review source records
          </button>
        </Panel>
        <Panel title="Understand the fuel estimate">
          <p>
            Fuel autonomy means the time recorded stock would last at the
            recorded daily consumption. It is a calculation, not a guarantee.
          </p>
          <Explanation
            d={d}
            title="Fuel autonomy"
            formula="Autonomy (days) = recorded fuel stock (L) ÷ daily burn (L/day)"
            inputs={[
              { label: "Inventory balance", value: n(e.fuel?.quantity) + " L" },
              { label: "Burn observation", value: n(e.burn?.value) + " L/day" },
              { label: "Observation time", value: date(e.burn?.observed_at) },
            ]}
            assumptions={[
              "Constant consumption and no new receipts.",
              "The ledger balance requires reconciliation with physical stock.",
              "Reserve targets and arrival uncertainty are handled in the comparison workspace.",
            ]}
            ids={[e.fuel?.id, e.burn?.id].filter(Boolean) as string[]}
          />
          <button onClick={() => p.go("scenarios")}>
            Compare response options
          </button>
        </Panel>
      </div>
      <details className="mission-details">
        <summary>
          <BookOpen size={16} /> New to POLARIS? Four terms explained
        </summary>
        <dl>
          <dt>Digital twin</dt>
          <dd>
            A model of assets and their registered relationships. This prototype
            topology requires station validation.
          </dd>
          <dt>Evidence</dt>
          <dd>
            The input records, timestamps, origin and assumptions supporting a
            result.
          </dd>
          <dt>Baseline</dt>
          <dd>
            The selected records used as the starting point for a comparison.
          </dd>
          <dt>Sensor recovery</dt>
          <dd>
            A reading meets the configured recovery condition. Closing a work
            order is a separate action.
          </dd>
        </dl>
      </details>
    </div>
  );
}
export function JourneyRail(p: Props) {
  const [dismiss, setDismiss] = useState(false),
    key = "polaris-guide-" + p.d.workspace;
  const id = sessionStorage.getItem(key);
  const a = p.d.alerts.find((a) => a.id === id);
  if (!id || !a || dismiss) return null;
  const work = p.d.work_orders.find((w) => w.alert_id === a.id),
    plans = (p.d.operations || []).filter(
      (r) => r.kind === "field_plan" && r.data.work_order_id === work?.id,
    ),
    inspection = (p.d.operations || []).some(
      (r) =>
        r.kind === "field_event" &&
        r.data.event === "inspection" &&
        plans.some((z) => z.id === r.data.plan_id),
    ),
    handover = (p.d.operations || []).some(
      (r) =>
        r.kind === "handover" &&
        r.data.snapshot?.inputs?.work_orders?.some(
          (w: any) => w.id === work?.id && w.status === "resolved",
        ),
    );
  const steps = [
    {
      name: "Review warning",
      done: a.status !== "open",
      act: () => p.investigate(a.id),
    },
    { name: "Assign work", done: !!work, act: () => p.investigate(a.id) },
    { name: "Field inspection", done: inspection, act: () => p.go("field") },
    {
      name: "Record resolution",
      done: work?.status === "resolved",
      act: () => p.investigate(a.id),
    },
    {
      name: "Save handover",
      done: handover,
      act: () => {
        p.go("operations");
        p.setFocus("handover");
      },
    },
  ];
  return (
    <aside className="journey-rail" aria-label="Guided demonstration">
      <div className="row">
        <strong>Guided incident · isolated simulation</strong>
        <button
          className="text-button"
          onClick={() => {
            setDismiss(true);
            sessionStorage.removeItem(key);
          }}
        >
          Hide guide
        </button>
      </div>
      <ol>
        {steps.map((s, i) => (
          <li key={s.name}>
            <button onClick={s.act} className={s.done ? "complete" : ""}>
              {s.done ? <Check size={15} /> : <b>{i + 1}</b>}
              {s.name}
            </button>
          </li>
        ))}
      </ol>
      <p>
        Complete each action explicitly. Inspection notes do not recover a
        sensor; a qualifying simulated reading is separate.
      </p>
    </aside>
  );
}
