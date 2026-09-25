import {
  ArrowUpRight,
  Zap,
  Fuel,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import type { Props } from "./pages";
import { energy, n, date } from "./model";

function Spark({
  values,
  label,
}: {
  values: (number | null)[];
  label: string;
}) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2)
    return <span className="spark-empty">Trend unavailable</span>;
  const min = Math.min(...valid),
    max = Math.max(...valid),
    span = max - min || 1;
  const paths: string[] = [];
  let current = "";
  values.forEach((v, i) => {
    if (v === null) {
      if (current) paths.push(current);
      current = "";
    } else {
      current += `${current ? "L" : "M"}${(i * 100) / Math.max(1, values.length - 1)},${27 - ((v - min) / span) * 24} `;
    }
  });
  if (current) paths.push(current);
  return (
    <svg
      className="kpi-spark"
      viewBox="0 0 100 30"
      role="img"
      aria-label={label}
    >
      {paths.map((path, i) => (
        <path
          key={i}
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      ))}
    </svg>
  );
}
export function OperationsMetrics(p: Props) {
  const e = energy(p.d),
    alerts = p.d.alerts.filter((a) => !a.recovered),
    orders = p.d.work_orders.filter((w) => w.status !== "resolved");
  const generation = p.d.measurements
    .filter((m) => m.metric === "generation")
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .slice(-24);
  const balance = generation.map((g) => {
    const l = p.d.measurements.find(
      (m) => m.metric === "consumption" && m.observed_at === g.observed_at,
    );
    return g.value !== null && l?.value != null ? g.value - l.value : null;
  });
  const burn = p.d.measurements
    .filter((m) => m.metric === "fuel_burn")
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .slice(-24);
  const tiles = [
    {
      name: "Power balance",
      value: e.balance,
      unit: "kW",
      icon: Zap,
      tone: "",
      detail: "Generation − consumption · calculated",
      values: balance,
      trend: "Balance / kW",
      times: generation,
      run: () =>
        p.evidence([e.gen?.id, e.load?.id].filter((x): x is string => !!x)),
    },
    {
      name: "Fuel autonomy",
      value: e.autonomy,
      unit: "days",
      icon: Fuel,
      tone: e.autonomy !== null && e.autonomy < p.planningTarget ? "amber" : "",
      detail:
        e.autonomy === null
          ? "Inventory and burn inputs required"
          : `${n(Math.max(0, p.planningTarget - e.autonomy))} d below assumed ${p.planningTarget} d target`,
      values: burn.map((m) => m.value),
      trend: "Burn / L/day",
      times: burn,
      run: () => p.go("energy"),
    },
    {
      name: "Needs attention",
      value: p.d.assets.length ? alerts.length : null,
      unit: "alerts",
      icon: AlertTriangle,
      tone: alerts.length ? "amber" : "",
      detail: "Unrecovered sensors · diagnosis unconfirmed",
      values: [],
      trend: "",
      times: [],
      run: () => p.go("maintenance"),
    },
    {
      name: "Maintenance backlog",
      value: p.d.assets.length ? orders.length : null,
      unit: "orders",
      icon: ClipboardList,
      tone: "",
      detail: orders.length
        ? `${orders.filter((w) => w.assignee).length} assigned · review ownership`
        : "Unresolved work orders in this workspace",
      values: [],
      trend: "",
      times: [],
      run: () => p.go("maintenance"),
    },
  ];
  return (
    <div className="operations-metrics">
      {tiles.map((t) => (
        <button
          className={`operations-metric ${t.tone}`}
          key={t.name}
          onClick={t.run}
        >
          <span className="metric-heading">
            <t.icon size={16} />
            {t.name}
            <ArrowUpRight size={14} />
          </span>
          <div className="metric-number">
            <strong>{n(t.value)}</strong>
            <span>{t.value !== null ? t.unit : "UNAVAILABLE"}</span>
            <Spark
              values={t.values}
              label={`${t.trend}. ${date(t.times[0]?.observed_at)} to ${date(t.times.at(-1)?.observed_at)}. ${t.times[0]?.origin || ""}. Nulls remain gaps.`}
            />
          </div>
          <span className="metric-detail">{t.detail}</span>
          <span className="metric-provenance">
            {t.times.length
              ? `${t.trend} · ${t.times[0].origin} · historical`
              : "Record count · no time-series inferred"}
          </span>
        </button>
      ))}
    </div>
  );
}
