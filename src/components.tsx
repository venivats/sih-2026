import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { X, ArrowUpRight, Database, Info } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import type { Snapshot, Reading } from "./types";
import { date, n } from "./model";
import { originLabel, readingAge } from "./evidenceModel";
export function Badge({
  children,
  tone = "ice",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title?: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      {title && (
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({
  title = "No records available",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Database size={28} />
      <h3>{title}</h3>
      <p>
        {children || "No verified records have been added to this workspace."}
      </p>
    </div>
  );
}
export function Notice({
  children,
  tone = "ice",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className={"notice " + tone}>
      <Info size={17} />
      <div>{children}</div>
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  sub,
  tone,
  click,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  sub: ReactNode;
  tone?: string;
  click?: () => void;
}) {
  return (
    <button className={"stat " + (tone || "")} onClick={click}>
      <span className="stat-label">
        {label}
        <ArrowUpRight size={15} />
      </span>
      <span className="stat-value">
        {n(value)} <small>{value != null ? unit : ""}</small>
      </span>
      <span className="stat-sub">{sub}</span>
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          aria-label="Close dialog"
          className="icon-button"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Trend({
  readings,
  metric,
  unit,
  second,
  title,
  thresholds = [],
  markerId,
  onEvidence,
}: {
  readings: Reading[];
  metric: string;
  unit: string;
  second?: string;
  title: string;
  thresholds?: { value: number; label: string; tone: string }[];
  markerId?: string;
  onEvidence?: (ids: string[]) => void;
}) {
  const [windowHours, setWindow] = useState(0);
  const gradientId = useId().replaceAll(":", "");
  const all = readings
    .filter((m) => m.metric === metric || (second && m.metric === second))
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  if (!all.length) return <Empty title="Measurements unavailable" />;
  const end = Date.parse(all.at(-1)!.observed_at);
  const series = all.filter(
    (m) =>
      !windowHours || Date.parse(m.observed_at) >= end - windowHours * 3600000,
  );
  const times = [...new Set(series.map((m) => m.observed_at))].sort();
  const data = times.map((time) => ({
    time: Date.parse(time),
    [metric]:
      series.find((m) => m.observed_at === time && m.metric === metric)
        ?.value ?? null,
    ...(second
      ? {
          [second]:
            series.find((m) => m.observed_at === time && m.metric === second)
              ?.value ?? null,
        }
      : {}),
  }));
  const missing = data.reduce(
    (sum, row) =>
      sum +
      (row[metric] == null ? 1 : 0) +
      (second && row[second] == null ? 1 : 0),
    0,
  );
  const spansDays = end - Date.parse(times[0]) >= 172800000;
  const axisTime = (value: number) =>
    new Date(value).toLocaleString(
      "en-GB",
      spansDays
        ? { day: "2-digit", month: "short", timeZone: "UTC" }
        : { hour: "2-digit", minute: "2-digit", timeZone: "UTC" },
    );
  const marker = series.find((m) => m.id === markerId);
  return (
    <>
      <div className="chart-toolbar">
        <div className="chart-meta">
          <span>
            {title} · {unit}
          </span>
          <Badge tone="muted">
            {[...new Set(series.map((m) => m.origin))].join(" + ")}
          </Badge>
        </div>
        <div
          className="segmented chart-range"
          role="group"
          aria-label={title + " historical range"}
        >
          {[
            { value: 0, label: "All" },
            { value: 24, label: "24 h" },
            { value: 6, label: "6 h" },
          ].map((w) => (
            <button
              key={w.value}
              aria-pressed={windowHours === w.value}
              className={windowHours === w.value ? "active" : ""}
              onClick={() => setWindow(w.value)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="chart"
        role="img"
        aria-label={`${title}, ${unit}. ${date(times[0])} to ${date(times.at(-1))}. ${missing} missing values. Historical, not live.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 24, right: 18, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9bdcf0" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#9bdcf0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#2a3744"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="time"
              type="number"
              ticks={data
                .filter(
                  (_, index) =>
                    index % Math.max(1, Math.ceil((data.length - 1) / 4)) ===
                      0 || index === data.length - 1,
                )
                .map((row) => row.time)}
              domain={["dataMin", "dataMax"]}
              minTickGap={60}
              tickFormatter={axisTime}
              tick={{ fontSize: 12, fill: "#a9bacb" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={46}
              domain={["auto", "auto"]}
              tick={{ fontSize: 12, fill: "#a9bacb" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#16232e",
                border: "1px solid #3b5264",
                borderRadius: 8,
              }}
              labelFormatter={(v) => date(new Date(Number(v)).toISOString())}
              formatter={(v, name) => [`${v ?? "Unavailable"} ${unit}`, name]}
            />
            {second && <Legend iconType="line" />}
            <Area
              name={second ? "Generation" : title}
              dataKey={metric}
              stroke={second ? "#70c8a7" : "#a6ddf0"}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              isAnimationActive={false}
              dot={data.length === 1}
              connectNulls={false}
            />
            {second && (
              <Line
                name="Consumption"
                dataKey={second}
                stroke="#a6ddf0"
                strokeWidth={2}
                dot={data.length === 1}
                isAnimationActive={false}
                connectNulls={false}
              />
            )}
            {thresholds.map((t) => (
              <ReferenceLine
                key={t.label}
                y={t.value}
                stroke={t.tone === "amber" ? "#f2be72" : "#85c9b5"}
                strokeDasharray="5 5"
                ifOverflow="extendDomain"
                label={{
                  value: `${t.label} ${t.value} ${unit}`,
                  position: "insideTopRight",
                  fontSize: 12,
                  fill: t.tone === "amber" ? "#f2be72" : "#85c9b5",
                }}
              />
            ))}
            {marker && marker.value !== null && (
              <ReferenceDot
                x={Date.parse(marker.observed_at)}
                y={marker.value}
                r={5}
                fill="#f2be72"
                stroke="#101c2a"
                ifOverflow="extendDomain"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {marker && (
        <button
          className="text-button trigger-link"
          onClick={() => onEvidence?.([marker.id])}
        >
          Amber marker: triggering reading · {date(marker.observed_at)}{" "}
          <ArrowUpRight size={14} />
        </button>
      )}
      <div className="chart-foot">
        <span>
          {date(times[0])} → {date(times.at(-1))}
        </span>
        <span>
          {missing} missing values · {series.length} records · Historical
        </span>
      </div>
      <p className="cadence-note">
        Windows end at the latest observation, not now. Null values are gaps;
        expected sampling cadence is not verified.
      </p>
      <details className="data-table">
        <summary>View accessible data table & evidence</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Observation time (UTC)</th>
                <th>Metric / unit</th>
                <th>Value</th>
                <th>Quality</th>
                <th>Origin / verification</th>
                {onEvidence && <th>Evidence</th>}
              </tr>
            </thead>
            <tbody>
              {series.map((m) => (
                <tr key={m.id}>
                  <td>{date(m.observed_at)}</td>
                  <td>
                    {m.metric.replaceAll("_", " ")} ({m.unit})
                  </td>
                  <td>{m.value === null ? "UNAVAILABLE" : n(m.value)}</td>
                  <td>{m.quality}</td>
                  <td>
                    {m.origin} / {m.verification}
                  </td>
                  {onEvidence && (
                    <td>
                      <button
                        className="text-button"
                        onClick={() => onEvidence([m.id])}
                      >
                        View record
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
export function Evidence({ d, ids }: { d: Snapshot; ids: string[] }) {
  const measurements = d.measurements.filter((m) => ids.includes(m.id));
  const items = d.inventory.filter((i) => ids.includes(i.id));
  const sourceIds = new Set([
    ...ids,
    ...items.map((i) => i.source_id),
    ...measurements.flatMap((m) => [m.source_id, ...m.lineage]),
  ]);
  return (
    <div className="evidence-content">
      <p className="muted">
        Selected station: {d.station} · workspace: {d.workspace}. Observation,
        acquisition and retrieval times are different events.
      </p>
      {d.shipments
        .filter((r) => ids.includes(r.id))
        .map((r) => (
          <div className="record" key={r.id}>
            <h3>{r.name}</h3>
            <dl>
              <dt>Expected arrival</dt>
              <dd>{date(r.eta)}</dd>
              <dt>Status</dt>
              <dd>{r.status}</dd>
              <dt>Record ID</dt>
              <dd>{r.id}</dd>
            </dl>
            <p>{r.risk}</p>
          </div>
        ))}
      {(d.operations || [])
        .filter((r) => ids.includes(r.id))
        .map((r) => (
          <div className="record" key={r.id}>
            <h3>{r.label}</h3>
            <Badge>{r.origin}</Badge>
            <dl>
              <dt>Record type</dt>
              <dd>{r.kind.replaceAll("_", " ")}</dd>
              <dt>Recorded</dt>
              <dd>{date(r.created_at)}</dd>
              <dt>Revision</dt>
              <dd>{r.version}</dd>
              <dt>Record ID</dt>
              <dd className="mono">{r.id}</dd>
            </dl>
            <pre className="evidence-json">
              {JSON.stringify(r.data, null, 2)}
            </pre>
          </div>
        ))}

      {d.edges
        .filter((e) => ids.includes(e.id))
        .map((e) => (
          <div className="record" key={e.id}>
            <h3>
              {d.assets.find((a) => a.id === e.upstream)?.name} →{" "}
              {d.assets.find((a) => a.id === e.downstream)?.name}
            </h3>
            <Badge tone={e.verified ? "teal" : "amber"}>
              {e.verified ? "Registered as verified" : "Topology unverified"}
            </Badge>
            <dl>
              <dt>Relationship</dt>
              <dd>{e.relationship}</dd>
              <dt>Supply path</dt>
              <dd>
                {e.backup
                  ? "Backup / successful transfer not established"
                  : "Primary registered dependency"}
              </dd>
              <dt>Record ID</dt>
              <dd className="mono">{e.id}</dd>
            </dl>
            <p>
              Path geometry is a schematic representation of stored
              relationships, not a surveyed location or a measurement of active
              flow.
            </p>
          </div>
        ))}
      {items.map((i) => (
        <div className="record" key={i.id}>
          <h3>{i.name} · inventory input</h3>
          <p>
            {n(i.quantity)} {i.unit} · {i.location} · revision {i.version}
          </p>
          <p className="mono">Record ID: {i.id}</p>
          <p>
            Balance is sourced from the inventory ledger. A ledger entry does
            not verify physical stock.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Movement time</th>
                  <th>Change ({i.unit})</th>
                  <th>Balance ({i.unit})</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {d.ledger
                  .filter((l) => l.item_id === i.id)
                  .map((l) => (
                    <tr key={l.id}>
                      <td>{date(l.created_at)}</td>
                      <td>{n(l.delta)}</td>
                      <td>{n(l.balance)}</td>
                      <td>{l.reason}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {measurements.map((m) => (
        <div className="record" key={m.id}>
          <div className="row">
            <strong>{m.metric.replaceAll("_", " ")}</strong>
            <Badge>{originLabel(m.origin)}</Badge>
          </div>
          <div className="value-inline">
            {n(m.value)} {m.unit}
          </div>
          <dl>
            <dt>Observation time</dt>
            <dd>{date(m.observed_at)}</dd>
            <dt>Observation age</dt>
            <dd>{readingAge(m)}</dd>
            <dt>Workspace retrieved</dt>
            <dd>{date(d.fetched_at)}</dd>
            <dt>Ingestion time</dt>
            <dd>{date(m.ingested_at)}</dd>
            <dt>Processing / quality</dt>
            <dd>
              {m.processing} / {m.quality}
            </dd>
            <dt>Verification</dt>
            <dd>{m.verification}</dd>
            <dt>Reading ID</dt>
            <dd className="mono">{m.id}</dd>
          </dl>
        </div>
      ))}
      {d.sources
        .filter((s) => sourceIds.has(s.id))
        .map((s) => (
          <div className="record" key={s.id}>
            <h3>{s.title}</h3>
            <p>{s.provider}</p>
            <dl>
              <dt>Origin / verification</dt>
              <dd>
                {s.origin} / {s.verification}
              </dd>
              <dt>Acquired</dt>
              <dd>{date(s.acquired_at)}</dd>
              <dt>Parser</dt>
              <dd>{s.parser_version}</dd>
              <dt>Source</dt>
              <dd>
                {s.reference.startsWith("https://") ? (
                  <a href={s.reference} target="_blank" rel="noreferrer">
                    Provider reference ↗
                  </a>
                ) : (
                  s.reference
                )}
              </dd>
              <dt>SHA-256</dt>
              <dd className="mono">
                {s.checksum ||
                  "Not applicable: internally generated demonstration"}
              </dd>
              <dt>Usage terms</dt>
              <dd>{s.licence}</dd>
            </dl>
            <h4>Transformations</h4>
            <ul>
              {s.transformations.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
      <Notice>
        A checksum checks file integrity. It does not establish scientific
        authenticity.
      </Notice>
    </div>
  );
}
