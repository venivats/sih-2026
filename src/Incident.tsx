import { AlertTriangle, ArrowUpRight, ShieldAlert } from "lucide-react";
import { Maintenance, type Props } from "./pages";
import { Badge, Empty, Notice, Panel, Trend } from "./components";
import { affected, date, energy, n } from "./model";

export function Incident(p: Props & { incidentId: string }) {
  const { d } = p;
  const alert = d.alerts.find((a) => a.id === p.incidentId);
  if (!alert)
    return <Empty title="Incident is no longer available in this workspace" />;
  const reading = d.measurements.find((m) => m.id === alert.measurement_id);
  const source = d.sources.find((s) => s.id === reading?.source_id);
  const asset = d.assets.find((a) => a.id === alert.asset_id);
  const rule = d.rules.find((r) => r.id === alert.rule_id);
  const downstream = affected(d, alert.asset_id);
  const backupEdges = d.edges.filter(
    (e) =>
      e.backup &&
      (downstream.some((a) => a.id === e.downstream) ||
        e.downstream === alert.asset_id),
  );
  const backupAssets = d.assets.filter((a) =>
    backupEdges.some((e) => e.upstream === a.id),
  );
  const e = energy(d);
  const diagnosis = d.work_orders.find(
    (w) => w.alert_id === alert.id,
  )?.diagnosis;
  return (
    <div className="incident-detail">
      <div className="incident-title">
        <AlertTriangle size={26} />
        <div>
          <span className="eyebrow">
            {asset?.code} / {asset?.name}
          </span>
          <h3>{alert.title}</h3>
          <p>
            Opened {date(alert.created_at)} · {alert.status}
          </p>
        </div>
        <Badge tone={alert.recovered ? "teal" : "amber"}>
          {alert.recovered ? "Sensor recovered" : "Sensor unrecovered"}
        </Badge>
      </div>
      <div className="investigation-grid">
        <Panel title="01 / Trigger & evidence">
          <div className="trigger-value">
            {n(reading?.value)} <span>{reading?.unit}</span>
          </div>
          <p>
            {reading?.metric.replaceAll("_", " ") ||
              "Trigger measurement unavailable"}
          </p>
          <dl>
            <dt>Observation time</dt>
            <dd>{date(reading?.observed_at)} · historical</dd>
            <dt>Classification</dt>
            <dd>
              {reading
                ? `${reading.origin} / ${reading.processing} / ${reading.verification}`
                : "Unavailable"}
            </dd>
            <dt>Source</dt>
            <dd>{source?.title || "Unavailable"}</dd>
            <dt>Quality flag</dt>
            <dd>{reading?.quality || "Unavailable"}</dd>
          </dl>
          <button
            className="text-button"
            onClick={() => p.evidence([alert.measurement_id])}
          >
            Original record & lineage <ArrowUpRight size={14} />
          </button>
        </Panel>
        <Panel title="02 / Rule & recovery">
          {rule ? (
            <>
              <dl>
                <dt>Trigger</dt>
                <dd>
                  Above {rule.threshold} {reading?.unit}
                </dd>
                <dt>Debounce</dt>
                <dd>{rule.debounce} consecutive samples</dd>
                <dt>Recovery</dt>
                <dd>
                  At or below {rule.recovery_threshold} {reading?.unit}
                </dd>
                <dt>Last evaluated</dt>
                <dd>{date(rule.last_observed)}</dd>
              </dl>
              <p>{rule.assumption}</p>
            </>
          ) : (
            <Empty title="Rule unavailable" />
          )}
          <Notice>
            Work completion does not recover a sensor. A qualifying reading is
            required.
          </Notice>
        </Panel>
      </div>
      {reading && (
        <Panel
          title="Measurement timeline"
          sub="Trigger and recovery thresholds are configured engineering assumptions"
        >
          <Trend
            readings={d.measurements.filter(
              (m) => m.asset_id === alert.asset_id,
            )}
            metric={reading.metric}
            unit={reading.unit}
            title={reading.metric.replaceAll("_", " ")}
            thresholds={
              rule
                ? [
                    {
                      value: rule.threshold,
                      label: "Trigger >",
                      tone: "amber",
                    },
                    {
                      value: rule.recovery_threshold,
                      label: "Recovery ≤",
                      tone: "teal",
                    },
                  ]
                : []
            }
            markerId={reading.id}
            onEvidence={p.evidence}
          />
        </Panel>
      )}
      <div className="investigation-grid">
        <Panel
          title="03 / Potential impact & backup"
          sub="Dependency exposure is not a confirmed outage"
        >
          <div className="chips">
            {downstream.map((a) => (
              <button key={a.id} onClick={() => p.select(a)}>
                {a.name} <ArrowUpRight size={12} />
              </button>
            ))}
            {!downstream.length && (
              <p>No downstream relationships registered.</p>
            )}
          </div>
          <h3>Alternate supply records</h3>
          {backupAssets.map((a) => (
            <p key={a.id}>
              {a.name}: {n(a.capacity)} {a.capacity_unit} · assumed capacity,
              availability unconfirmed
            </p>
          ))}
          {!backupAssets.length && <p>No alternate supply documented.</p>}
          <p>
            Current recorded demand: {n(e.load?.value)} kW. Baseline fuel
            autonomy: {n(e.autonomy)} days (inventory ÷ daily burn). These are
            not post-failure predictions.
          </p>
          <Notice tone="amber">
            Illustrative, incomplete topology. Switching logic, equipment
            readiness and operating constraints have not been validated.
          </Notice>
          <button
            className="text-button"
            onClick={() => {
              p.go("scenarios");
            }}
          >
            Compare a what-if scenario <ArrowUpRight size={14} />
          </button>
        </Panel>
        <Panel title="04 / Inspection & responsibility">
          <div className="row start">
            <ShieldAlert size={20} />
            <strong>{diagnosis || "Cause not confirmed"}</strong>
          </div>
          <p>
            Suggested inspection, not an official station procedure: verify the
            sensor reading against an independent reference, review recent
            changes, and have the assigned engineer inspect the affected
            equipment before selecting an intervention.
          </p>
          <p>
            Assign a responsible person and due date below. Record findings,
            spare use and remaining uncertainty in the work order.
          </p>
          {!p.write && (
            <Notice>
              This workspace is read-only. Start a private demo from the
              overview to practise the workflow.
            </Notice>
          )}
        </Panel>
      </div>
      <Maintenance {...p} />
    </div>
  );
}
