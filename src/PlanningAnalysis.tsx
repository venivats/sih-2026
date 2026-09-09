import { ArrowUpRight, Network, ShieldQuestion } from "lucide-react";
import type { Props } from "./pages";
import { Panel, Badge, Notice } from "./components";
import { energy, affected, n, date } from "./model";

export function PlanningAnalysis(p: Props) {
  const e = energy(p.d),
    target = p.planningTarget;
  const rows = p.d.ledger.filter((l) => l.item_id === e.fuel?.id);
  const sum = rows.reduce((total, l) => total + l.delta, 0);
  const gap = e.autonomy === null ? null : e.autonomy - target;
  return (
    <div className="two-columns">
      <Panel
        title="Planning target & sensitivity"
        sub="Operator assumption · this browser tab"
      >
        <label>
          Assumed resource target (days)
          <input
            aria-label="Assumed resource target (days)"
            type="number"
            min={1}
            max={365}
            value={target}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              if (Number.isFinite(v) && v >= 1 && v <= 365)
                p.setPlanningTarget(v);
            }}
          />
        </label>
        <div className="planning-gap">
          <strong className={gap !== null && gap < 0 ? "amber-text" : ""}>
            {n(gap)}
          </strong>
          <span>days relative to your target</span>
        </div>
        <p className="small-copy">
          The initial 180-day target is an illustrative planning assumption, not
          an NCPOR operating requirement. Burn observation:{" "}
          {date(e.burn?.observed_at)}.
        </p>
        <div className="sensitivity">
          <div>
            <span>20% lower burn</span>
            <strong>
              {n(e.autonomy === null ? null : e.autonomy / 0.8)} d
            </strong>
          </div>
          <div>
            <span>Baseline burn</span>
            <strong>{n(e.autonomy)} d</strong>
          </div>
          <div>
            <span>20% higher burn</span>
            <strong>
              {n(e.autonomy === null ? null : e.autonomy / 1.2)} d
            </strong>
          </div>
        </div>
        <p className="small-copy muted">
          Sensitivity bounds are selected assumptions, not a statistical
          confidence interval. Each estimate uses the same inventory balance.
        </p>
        <button
          className="text-button"
          onClick={() =>
            p.evidence([e.fuel?.id, e.burn?.id].filter((v): v is string => !!v))
          }
        >
          Trace all calculation inputs <ArrowUpRight size={14} />
        </button>
      </Panel>
      <Panel
        title="Fuel ledger reconciliation"
        sub="One inventory source across energy and logistics"
      >
        <dl>
          <dt>Registered balance</dt>
          <dd>{n(e.fuel?.quantity)} L</dd>
          <dt>Sum of recorded movements</dt>
          <dd>{rows.length ? n(sum) : "Unavailable"} L</dd>
          <dt>Reconciliation difference</dt>
          <dd>
            {e.fuel && rows.length ? n(e.fuel.quantity - sum) : "Unavailable"} L
          </dd>
          <dt>Inventory revision</dt>
          <dd>{e.fuel?.version ?? "Unavailable"}</dd>
        </dl>
        <Notice>
          {rows.length && e.fuel
            ? Math.abs(e.fuel.quantity - sum) < 0.001
              ? "Ledger movements reconcile with the registered balance. This does not verify physical tank volume."
              : "Opening balance or movements may be incomplete. Investigate the difference before using stock for planning."
            : "No complete movement history is available for reconciliation."}
        </Notice>
        <p className="small-copy">
          No tank-level sensor is connected. A physical measurement and its
          calibration record would improve confidence in the inventory input.
        </p>
        <button className="text-button" onClick={() => p.go("logistics")}>
          Review movements & ownership <ArrowUpRight size={14} />
        </button>
      </Panel>
    </div>
  );
}

export function ServiceContinuity(p: Props) {
  const services = p.d.assets.filter((a) =>
    ["heating", "water", "communications", "load"].includes(a.kind),
  );
  return (
    <Panel
      title="Essential service continuity"
      sub="Trace a service to its supplies, evidence gaps and outstanding investigation"
      action={<Network size={20} />}
    >
      <div className="service-grid">
        {services.map((a) => {
          const upstream = affected(p.d, a.id, true);
          const exposed = p.d.alerts.filter(
            (alert) =>
              !alert.recovered && upstream.some((x) => x.id === alert.asset_id),
          );
          const reads = p.d.measurements.filter(
            (m) => m.asset_id === a.id && m.value !== null,
          );
          const backups = p.d.edges.filter(
            (edge) =>
              edge.backup &&
              [a.id, ...upstream.map((x) => x.id)].includes(edge.downstream),
          );
          return (
            <button
              key={a.id}
              onClick={() => {
                p.setFocus(a.id);
                p.go("twin");
              }}
            >
              <span className="row">
                <strong>{a.name}</strong>
                <ArrowUpRight size={14} />
              </span>
              <Badge tone={exposed.length ? "amber" : "muted"}>
                {exposed.length
                  ? "Upstream investigation"
                  : "Availability unconfirmed"}
              </Badge>
              <span>
                {upstream.length} upstream assets · {backups.length} backup
                links
              </span>
              <small>
                <ShieldQuestion size={12} />
                {reads.length
                  ? "Inspect historical evidence"
                  : "Direct subsystem measurements unavailable"}
              </small>
            </button>
          );
        })}
        {!services.length && <p>No service dependencies registered.</p>}
      </div>
      <p className="small-copy muted">
        Research continuity depends on these shared services.
        Experiment-specific requirements, thermal holdover and actual failover
        readiness have not been supplied.
      </p>
    </Panel>
  );
}
