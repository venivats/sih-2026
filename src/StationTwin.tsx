import { EquipmentIdentity } from "./Appearance";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Network,
  FileSearch,
  Wrench,
  ShieldQuestion,
  Package,
  Clock,
} from "lucide-react";
import type { Props } from "./pages";
import { Twin, AssetIcon } from "./Twin";
import { Badge, Empty } from "./components";
import { affected, latest, n, date } from "./model";

export function StationTwin(p: Props) {
  const [tab, setTab] = useState("evidence");
  const asset =
    p.d.assets.find((a) => a.id === p.focus) ||
    p.d.assets.find((a) => a.code === "GEN-A") ||
    p.d.assets[0];
  const [direction, setDirection] = useState(false);
  if (!asset)
    return (
      <Empty title="Station topology unavailable">
        Register verified assets and relationships to begin.
      </Empty>
    );
  const alerts = p.d.alerts.filter(
    (a) => a.asset_id === asset.id && !a.recovered,
  );
  const rule = p.d.rules.find((r) => r.asset_id === asset.id);
  const readings = [
    ...new Set(
      p.d.measurements
        .filter((m) => m.asset_id === asset.id)
        .map((m) => m.metric),
    ),
  ].map((metric) => latest(p.d, metric, asset.id)!);
  const main = readings.find((m) => m.metric === rule?.metric) || readings[0];
  const order = p.d.work_orders.find(
    (w) => w.asset_id === asset.id && w.status !== "resolved",
  );
  const spares = p.d.inventory.filter((i) => i.asset_code === asset.code);
  const linked = affected(p.d, asset.id, direction);
  const backup = p.d.edges.filter(
    (e) =>
      e.backup &&
      [asset.id, ...affected(p.d, asset.id).map((a) => a.id)].includes(
        e.downstream,
      ),
  );
  const tabs = [
    { id: "evidence", label: "Evidence", icon: FileSearch },
    { id: "impact", label: "Impact", icon: Network },
    { id: "action", label: "Action", icon: Wrench },
  ];
  return (
    <section
      className="station-twin"
      aria-label="Station schematic and asset inspector"
    >
      <div className="drawing-board">
        <div className="drawing-head">
          <div>
            <span className="eyebrow">SYSTEM DEPENDENCIES</span>
            <h2>The connected station</h2>
          </div>
          <Badge tone="muted">Engineering demonstration</Badge>
        </div>
        <Twin
          d={p.d}
          selected={asset.id}
          onSelect={(a) => p.setFocus(a.id)}
          onEdge={(id) => p.evidence([id])}
          compact
        />
        <div className="drawing-foot">
          <span>
            <Network size={14} />
            {p.d.assets.filter((a) => a.kind !== "environment").length} assets ·{" "}
            {p.d.edges.length} stored relationships · animated emphasis, not
            flow
          </span>
          <button onClick={() => p.select(asset)}>
            Full asset record <ArrowUpRight size={14} />
          </button>
        </div>
        <details className="relationship-list">
          <summary>Inspect relationship records</summary>
          {p.d.edges.map((edge) => (
            <button key={edge.id} onClick={() => p.evidence([edge.id])}>
              Relationship:{" "}
              {p.d.assets.find((a) => a.id === edge.upstream)?.code} →{" "}
              {p.d.assets.find((a) => a.id === edge.downstream)?.code} ·{" "}
              {edge.relationship}
              {edge.backup ? " · backup" : ""}
              <ArrowUpRight size={13} />
            </button>
          ))}
        </details>
      </div>
      <aside className="asset-inspector" aria-label="Asset inspector">
        <div className="inspector-eyebrow">
          <span>ASSET INSPECTOR</span>
          <span className="mono">{asset.code}</span>
        </div>
        <div className="inspector-title">
          <AssetIcon kind={asset.kind} size={25} />
          <h2>{asset.name}</h2>
        </div>
        <EquipmentIdentity code={asset.code} />
        <div className="health-pair">
          <span>
            <i
              className={
                alerts.length ? "status-dot warning" : "status-dot unknown"
              }
            />
            Equipment{" "}
            <b>{alerts.length ? "Needs investigation" : "Not confirmed"}</b>
          </span>
          <span>
            <Clock size={12} />
            Data <b>{readings.length ? "Historical" : "Unavailable"}</b>
          </span>
        </div>
        <button
          className="inspector-reading"
          disabled={!main}
          onClick={() => main && p.evidence([main.id])}
        >
          <span>
            {main?.metric.replaceAll("_", " ") || "No measurement registered"}
          </span>
          <strong className={alerts.length ? "amber-text" : ""}>
            {n(main?.value)}
            <small>{main?.unit === "degC" ? "°C" : main?.unit}</small>
          </strong>
          <span>
            {main
              ? `${main.origin} · ${date(main.observed_at)}`
              : "Missing data remains unavailable"}
            <ArrowUpRight size={13} />
          </span>
        </button>
        <div
          className="inspector-tabs"
          role="tablist"
          aria-label="Asset details"
        >
          {tabs.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              id={`inspector-${t.id}`}
              aria-controls="inspector-content"
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                let next = i;
                if (e.key === "ArrowRight") next = (i + 1) % 3;
                else if (e.key === "ArrowLeft") next = (i + 2) % 3;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = 2;
                else return;
                e.preventDefault();
                setTab(tabs[next].id);
                document.getElementById(`inspector-${tabs[next].id}`)?.focus();
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
        <div
          className="inspector-content"
          id="inspector-content"
          role="tabpanel"
          aria-labelledby={`inspector-${tab}`}
        >
          {tab === "evidence" ? (
            <>
              {rule && (
                <div className="rule-summary">
                  <span>RULE & RECOVERY</span>
                  <strong>
                    Trigger &gt; {rule.threshold} °C · {rule.debounce} samples
                  </strong>
                  <p>
                    Recover at ≤ {rule.recovery_threshold} °C. {rule.assumption}
                  </p>
                </div>
              )}
              <dl className="inspector-facts">
                <dt>Source status</dt>
                <dd>{main?.verification || "Unavailable"}</dd>
                <dt>Processing</dt>
                <dd>{main?.processing || "Unavailable"}</dd>
                <dt>Assumed capacity</dt>
                <dd>
                  {n(asset.capacity)} {asset.capacity_unit}
                </dd>
                <dt>Documentation</dt>
                <dd>
                  {asset.documentation.length
                    ? `${asset.documentation.length} linked reference(s)`
                    : "Not supplied"}
                </dd>
              </dl>
              <button className="text-button" onClick={() => p.select(asset)}>
                Telemetry, specifications & history <ArrowUpRight size={14} />
              </button>
            </>
          ) : tab === "impact" ? (
            <>
              <div className="segmented">
                <button
                  aria-pressed={!direction}
                  onClick={() => setDirection(false)}
                >
                  Downstream
                </button>
                <button
                  aria-pressed={direction}
                  onClick={() => setDirection(true)}
                >
                  Upstream
                </button>
              </div>
              <div className="inspector-paths">
                {linked.map((a) => (
                  <button key={a.id} onClick={() => p.setFocus(a.id)}>
                    <AssetIcon kind={a.kind} size={15} />
                    <span>{a.name}</span>
                    <ArrowRight size={13} />
                  </button>
                ))}
              </div>
              {!linked.length && <p>No paths registered in this direction.</p>}
              <p className="small-copy">
                <b>{backup.length} alternate supply link(s).</b> Capacity and
                successful transfer are assumptions; reachability does not
                confirm an outage.
              </p>
            </>
          ) : (
            <>
              <div className="rule-summary">
                <span>NEXT RESPONSIBLE ACTION</span>
                <strong>
                  {order
                    ? `${order.assignee} · ${order.status.replaceAll("_", " ")}`
                    : alerts.length
                      ? "Acknowledge & assign an engineer"
                      : "Review measurement coverage"}
                </strong>
                <p>
                  {order
                    ? `Due ${order.due_date}. ${order.diagnosis}`
                    : "Verify the reading independently before confirming a diagnosis."}
                </p>
              </div>
              <div className="inspector-spares">
                {spares.map((i) => {
                  const reserved = (p.d.reservations || [])
                    .filter(
                      (r) => r.item_id === i.id && r.status === "reserved",
                    )
                    .reduce((sum, r) => sum + r.remaining, 0);
                  return (
                    <button key={i.id} onClick={() => p.go("logistics")}>
                      <Package size={16} />
                      <span>
                        {i.name}
                        <small>
                          {n(i.quantity - reserved, 0)} {i.unit} available ·{" "}
                          {n(reserved, 0)} reserved
                        </small>
                      </span>
                      <ArrowUpRight size={14} />
                    </button>
                  );
                })}
                {!spares.length && <p>No linked spare inventory.</p>}
              </div>
              <p className="small-copy">
                Work completion and sensor recovery are tracked separately.
              </p>
            </>
          )}
        </div>
        <div className="inspector-actions">
          <button
            className="primary full"
            onClick={() =>
              alerts[0] ? p.investigate(alerts[0].id) : p.select(asset)
            }
          >
            {alerts.length ? "Review incident" : "Review asset"}
            <ArrowRight size={16} />
          </button>
          <button
            className="small-button full"
            onClick={() => p.go("scenarios")}
          >
            Compare responses <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="inspector-disclaimer">
          <ShieldQuestion size={13} />
          Illustrative topology · validation pending
        </div>
      </aside>
    </section>
  );
}
