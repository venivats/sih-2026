import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Download,
  ClipboardList,
  Database,
  Fuel,
  AlertTriangle,
} from "lucide-react";
import type { Props } from "./pages";
import { Badge, Panel, Empty, Notice, Modal } from "./components";
import { energy, n, date } from "./model";

export function ResourceHorizon(p: Props) {
  const [days, setDays] = useState(45);
  const e = energy(p.d);
  const remaining = e.autonomy == null ? null : e.autonomy - days;
  const litres =
    e.fuel && e.burn?.value != null && e.burn.value > 0
      ? e.fuel.quantity - e.burn.value * days
      : null;
  return (
    <Panel
      className="horizon-panel"
      title="Will the fuel last?"
      sub="A quick, isolated planning check — not an arrival forecast"
      action={<Fuel size={21} />}
    >
      <div className="horizon-numbers">
        <div>
          <span>Recorded baseline</span>
          <strong>
            {n(e.autonomy)} <small>days</small>
          </strong>
        </div>
        <ArrowRight size={22} />
        <div>
          <span>Margin at your horizon</span>
          <strong
            className={remaining != null && remaining < 0 ? "amber-text" : ""}
          >
            {n(remaining)} <small>days</small>
          </strong>
        </div>
      </div>
      <label className="horizon-label">
        Assumed days until resupply <output>{days} days</output>
        <input
          aria-label="Assumed days until resupply"
          type="range"
          min="0"
          max="90"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        />
      </label>
      <div className="horizon-scale">
        <span>Baseline / day 0</span>
        <span>90-day horizon</span>
      </div>
      <div
        className={
          "horizon-conclusion " +
          (remaining != null && remaining < 0 ? "shortfall" : "")
        }
      >
        {remaining == null
          ? "Baseline unavailable — add inventory and fuel-burn evidence first."
          : remaining < 0
            ? `${n(Math.abs(litres!))} L estimated shortfall at day ${days}. Review demand and resupply assumptions.`
            : `${n(litres)} L estimated reserve at day ${days}, under constant consumption.`}
      </div>
      <details>
        <summary>Formula & input evidence</summary>
        <p>
          Autonomy = {n(e.fuel?.quantity)} L ÷ {n(e.burn?.value)} L/day. Margin
          = autonomy − {days} assumed days. Fuel reserve = inventory − daily
          burn × horizon.
        </p>
        <p>
          Burn observation: {date(e.burn?.observed_at)} ·{" "}
          {e.burn?.origin || "unavailable"}. Inventory and telemetry may have
          different record times; this is a historical baseline exercise, not a
          current fuel forecast. Constant burn, no replenishment, no contingency
          reserve.
        </p>
        <div className="actions">
          <button className="text-button" onClick={() => p.go("logistics")}>
            Inventory ledger <ArrowUpRight size={14} />
          </button>
          {e.burn && (
            <button
              className="text-button"
              onClick={() => p.evidence([e.burn!.id])}
            >
              Burn evidence <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </details>
      <button className="text-button" onClick={() => p.go("scenarios")}>
        Compare demand & backup scenarios <ArrowUpRight size={14} />
      </button>
    </Panel>
  );
}

export function Briefing(p: Props) {
  const [exported, setExported] = useState<{
    text: string;
    url: string;
  } | null>(null);
  useEffect(
    () => () => {
      if (exported) URL.revokeObjectURL(exported.url);
    },
    [exported],
  );
  const d = p.d,
    e = energy(d),
    alerts = d.alerts.filter((a) => !a.recovered),
    work = d.work_orders.filter((w) => w.status !== "resolved"),
    low = d.inventory.filter((i) => i.quantity <= i.reorder_point);
  const missing = d.measurements.filter((m) => m.value === null).length;
  function download() {
    const lines = [
      "POLARIS / STATION BRIEF",
      d.station.toUpperCase(),
      "Independent SIH prototype. Not an operationally validated Antarctic system.",
      `Workspace: ${d.workspace}`,
      `Report assembled: ${new Date().toISOString()}`,
      "Historical/simulated records do not establish current station conditions.",
      "",
      `Unrecovered alerts: ${alerts.length}`,
      ...alerts.map(
        (a) => `- ${a.title}; ${a.status}; trigger reading ${a.measurement_id}`,
      ),
      "",
      `Open work orders: ${work.length}`,
      ...work.map(
        (w) =>
          `- ${w.title}; owner ${w.assignee}; due ${w.due_date}; status ${w.status}`,
      ),
      "",
      `Fuel inventory: ${n(e.fuel?.quantity)} L; burn ${n(e.burn?.value)} L/day; autonomy ${n(e.autonomy)} days. Constant-burn estimate.`,
      `Burn observation: ${date(e.burn?.observed_at)}; input reading ${e.burn?.id || "unavailable"}; inventory item ${e.fuel?.id || "unavailable"}`,
      `Items at/below reorder: ${low.length}`,
      ...low.map(
        (i) =>
          `- ${i.name}: ${i.quantity} ${i.unit}; threshold ${i.reorder_point} ${i.unit}`,
      ),
      `Null measurement records: ${missing}`,
      "",
      "Sources:",
      ...d.sources.map(
        (s) =>
          `- ${s.title}; ${s.origin}/${s.verification}; source ${s.id}; ${s.reference}`,
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    setExported({ text: lines.join("\n"), url });
  }
  return (
    <div className="brief-view">
      <div className="brief-intro">
        <div>
          <span className="eyebrow">COMPILED FROM WORKSPACE RECORDS</span>
          <h2>Your station, in one briefing.</h2>
          <p>
            A deterministic summary of evidence and outstanding actions. No
            AI-generated diagnoses.
          </p>
        </div>
        <button className="primary" onClick={download}>
          <Download size={16} />
          Export brief
        </button>
      </div>
      <div className="brief-layout">
        <Panel
          title="Action board"
          sub="Registered issues, ownership and next steps"
          className="action-board"
        >
          {alerts.map((a, index) => (
            <div className="brief-action" key={a.id}>
              <span className="action-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <Badge tone="amber">Unrecovered sensor</Badge>
                <h3>{a.title}</h3>
                <p>
                  {d.work_orders.find((w) => w.alert_id === a.id)?.assignee ||
                    "No responsible person assigned"}{" "}
                  · {a.status}
                </p>
              </div>
              <button
                className="small-button"
                onClick={() => p.investigate(a.id)}
              >
                Investigate <ArrowUpRight size={14} />
              </button>
            </div>
          ))}
          {low.map((i, index) => (
            <div className="brief-action" key={i.id}>
              <span className="action-index">
                {String(alerts.length + index + 1).padStart(2, "0")}
              </span>
              <div>
                <Badge tone="amber">At / below reorder</Badge>
                <h3>{i.name}</h3>
                <p>
                  {n(i.quantity)} {i.unit} available · threshold{" "}
                  {n(i.reorder_point)} {i.unit}
                </p>
              </div>
              <button
                className="small-button"
                onClick={() => p.go("logistics")}
              >
                Replenish <ArrowUpRight size={14} />
              </button>
            </div>
          ))}
          {!alerts.length && !low.length && (
            <Empty title="No alert or reorder triggers">
              This does not establish station health. Review evidence coverage.
            </Empty>
          )}
          <Notice>
            {missing} null measurement records. Missing values are excluded from
            estimates, never replaced with simulated operational values.
          </Notice>
        </Panel>
        <ResourceHorizon {...p} />
      </div>
      {exported && (
        <Modal
          title="Station brief export"
          onClose={() => {
            URL.revokeObjectURL(exported.url);
            setExported(null);
          }}
          wide
        >
          <p>
            Review the exact report below. Observation times, source identifiers
            and prototype limitations travel with the text.
          </p>
          <a
            className="primary"
            href={exported.url}
            download={`POLARIS-${d.station}-brief.txt`}
          >
            Save text file <Download size={16} />
          </a>
          <pre className="brief-export">{exported.text}</pre>
        </Modal>
      )}
      <Panel
        title="Who owns the next action?"
        sub="Unresolved work orders in the selected workspace"
      >
        <div className="owner-board">
          {work.length ? (
            work.map((w) => (
              <button key={w.id} onClick={() => p.investigate(w.alert_id)}>
                <ClipboardList size={22} />
                <strong>{w.assignee}</strong>
                <span>{w.title}</span>
                <small>
                  Due {w.due_date} · {w.priority} ·{" "}
                  {w.status.replaceAll("_", " ")}
                </small>
              </button>
            ))
          ) : (
            <Empty title="No unresolved work orders">
              Acknowledge an alert to assign an owner, due date and maintenance
              action.
            </Empty>
          )}
        </div>
      </Panel>
    </div>
  );
}

export function Readiness(p: Props) {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const assets = p.d.assets.map((asset) => {
    const rows = p.d.measurements
      .filter((m) => m.asset_id === asset.id)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    const metrics = [...new Set(rows.map((m) => m.metric))].map(
      (metric) => rows.find((m) => m.metric === metric)!,
    );
    return {
      asset,
      rows,
      metrics,
      available: metrics.some((m) => m.value !== null),
    };
  });
  const available = assets.filter((a) => a.available).length;
  return (
    <div className="readiness-view">
      <div className="brief-intro">
        <div>
          <span className="eyebrow">COVERAGE IS NOT CONFIDENCE</span>
          <h2>What do we actually know?</h2>
          <p>
            Inspect every registered system, its latest measurements and source
            classification.
          </p>
        </div>
        <Database size={36} />
      </div>
      <div className="coverage-summary">
        <div>
          <strong>
            {available}
            <span> / {assets.length}</span>
          </strong>
          <p>Assets with at least one non-null latest metric</p>
        </div>
        <div>
          <strong>{assets.length - available}</strong>
          <p>Assets without an available latest measurement</p>
        </div>
        <div>
          <strong>
            {p.d.measurements.filter((m) => m.value === null).length}
          </strong>
          <p>Explicit null records across the full history</p>
        </div>
      </div>
      <Panel
        title="Evidence coverage matrix"
        sub="Latest means most recent record, not live telemetry"
        action={
          <label className="missing-filter">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => setOnlyMissing(e.target.checked)}
            />
            Only missing readings
          </label>
        }
      >
        {!assets.length ? (
          <Empty title="No asset evidence registered" />
        ) : (
          <div className="table-scroll">
            <table className="coverage-table">
              <thead>
                <tr>
                  <th>System</th>
                  <th>Latest recorded metrics</th>
                  <th>Observation time</th>
                  <th>Source / quality</th>
                  <th>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {assets
                  .filter((a) => !onlyMissing || !a.available)
                  .map(({ asset, metrics }) => (
                    <tr key={asset.id}>
                      <td>
                        <strong>{asset.name}</strong>
                        <small>{asset.code}</small>
                      </td>
                      <td>
                        {metrics.length ? (
                          metrics.map((m) => (
                            <div key={m.id}>
                              {m.metric.replaceAll("_", " ")}:{" "}
                              <b>
                                {m.value === null
                                  ? "UNAVAILABLE"
                                  : `${n(m.value)} ${m.unit}`}
                              </b>
                            </div>
                          ))
                        ) : (
                          <span className="missing-signal">
                            <AlertTriangle size={14} />
                            No readings
                          </span>
                        )}
                      </td>
                      <td>
                        {metrics.map((m) => (
                          <div key={m.id}>{date(m.observed_at)}</div>
                        ))}
                        {!metrics.length && "Unavailable"}
                      </td>
                      <td>
                        {metrics.map((m) => (
                          <div key={m.id}>
                            {m.origin} / {m.verification}
                            <small>{m.quality}</small>
                          </div>
                        ))}
                      </td>
                      <td>
                        {metrics.length ? (
                          <button
                            className="text-button"
                            onClick={() => p.evidence(metrics.map((m) => m.id))}
                          >
                            Evidence <ArrowUpRight size={14} />
                          </button>
                        ) : (
                          <button
                            className="text-button"
                            onClick={() => p.select(asset)}
                          >
                            Asset record <ArrowUpRight size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {onlyMissing && assets.every((a) => a.available) && (
              <Empty title="Every registered asset has a recorded value">
                This is coverage, not verified operational health.
              </Empty>
            )}
          </div>
        )}
      </Panel>
      <Notice>
        Simulation, observation and reanalysis remain distinct. A checksum
        proves byte integrity; it does not prove scientific authenticity. No
        live station telemetry is connected in this public demonstration.
      </Notice>
    </div>
  );
}
