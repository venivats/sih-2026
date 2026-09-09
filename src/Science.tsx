import { useState, useEffect } from "react";
import { Panel, Badge, Notice, Empty, Trend } from "./components";
import { StationContext } from "./StationContext";
import type { Props } from "./pages";
import { n, date, energy, affected, calculate } from "./model";
import {
  thermal,
  capacityPath,
  qualityFindings,
  benchmark,
} from "./scienceModel";
import { mutate } from "./api";
import { randomId } from "./id";
import { baseline } from "./operationsModel";

export function IncidentReplay(p: Props) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false);
  const events = [
    ...p.d.alerts.map((a) => ({
      id: a.id,
      at: a.created_at,
      title: a.title,
      kind: "Alert",
      asset: a.asset_id,
      ids: [a.measurement_id],
    })),
    ...p.d.audit.map((a) => ({
      id: a.id,
      at: a.created_at,
      title: a.action.replaceAll("_", " "),
      kind: "Audit",
      asset:
        p.d.work_orders.find((w) => w.id === a.entity_id)?.asset_id ||
        p.d.alerts.find((r) => r.id === a.entity_id)?.asset_id ||
        "",
      ids: [],
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const event = events[Math.min(index, events.length - 1)];
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setIndex((i) => {
          if (i >= events.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      1400,
    );
    return () => clearInterval(timer);
  }, [playing, events.length]);
  return (
    <Panel
      title="Incident replay"
      sub="Historical alert and audit events · replay does not make data live"
    >
      {!event ? (
        <Empty title="No incident events recorded">
          Run a private exercise to create a traceable workflow.
        </Empty>
      ) : (
        <>
          <div className="replay-event">
            <Badge>{event.kind}</Badge>
            <strong>{event.title}</strong>
            <p>{date(event.at)}</p>
            <small>
              {event.asset
                ? p.d.assets.find((a) => a.id === event.asset)?.name
                : "Station workflow"}{" "}
              · {index + 1} of {events.length}
            </small>
            <div className="actions">
              <button
                className="small-button"
                disabled={!event.ids.length}
                onClick={() => p.evidence(event.ids)}
              >
                Event evidence
              </button>
              <button
                className="small-button"
                disabled={!event.asset}
                onClick={() => {
                  const a = p.d.assets.find((a) => a.id === event.asset);
                  if (a) p.select(a);
                }}
              >
                Inspect affected asset
              </button>
            </div>
          </div>
          <label>
            Historical event
            <input
              aria-label="Replay event"
              type="range"
              min="0"
              max={events.length - 1}
              value={index}
              onChange={(e) => {
                setPlaying(false);
                setIndex(+e.target.value);
              }}
            />
          </label>
          <button
            className="small-button"
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? "Pause replay" : "Play replay"}
          </button>
          <p>
            Event times describe when records were created. Open measurement
            evidence for its separate observation time. Work completion does not
            establish sensor recovery.
          </p>
          <ol className="event-track">
            {events.map((e, i) => (
              <li key={e.id}>
                <button
                  aria-current={i === index ? "step" : undefined}
                  onClick={() => {
                    setPlaying(false);
                    setIndex(i);
                  }}
                >
                  <small>{date(e.at)}</small>
                  {e.title}
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}

function Thermal() {
  const [tin, Tin] = useState(20),
    [tout, Tout] = useState(-30),
    [target, Target] = useState(5),
    [c, C] = useState(80),
    [h, H] = useState(2);
  const hours = thermal(tin, tout, target, c, h);
  const pts = Array.from({ length: 49 }, (_, t) => ({
    t,
    temp: tout + (tin - tout) * Math.exp((-h * t) / c),
  }));
  return (
    <Panel
      title="Heating-loss sensitivity"
      sub="Lumped thermal model · illustrative assumptions, not station calibration"
    >
      <div className="model-inputs">
        {[
          ["Initial indoor · °C", tin, Tin, -10, 35],
          ["Ambient · °C", tout, Tout, -80, 10],
          ["Review threshold · °C", target, Target, 0, 15],
          ["Effective heat capacity · kWh/K", c, C, 1, 1000],
          ["Heat loss coefficient · kW/K", h, H, 0.1, 20],
        ].map(([label, v, set, min, max]) => (
          <label key={String(label)}>
            {String(label)}
            <input
              type="number"
              step="0.1"
              min={Number(min)}
              max={Number(max)}
              value={v as number}
              onChange={(e) => (set as (x: number) => void)(+e.target.value)}
            />
          </label>
        ))}
      </div>
      <strong className="big-number">
        {n(hours)} <small>hours to threshold</small>
      </strong>
      <p>
        {hours === null
          ? "Enter positive model coefficients and initial > threshold > ambient."
          : "T(t) = ambient + (initial − ambient) × exp(−heat loss × t / heat capacity)."}
      </p>
      {hours !== null && (
        <svg
          viewBox="0 0 580 190"
          className="thermal-chart"
          role="img"
          aria-label="Assumption-based indoor temperature, zero to 48 hours"
        >
          <line x1="45" x2="550" y1="155" y2="155" stroke="var(--muted)" />
          <line x1="45" x2="45" y1="20" y2="155" stroke="var(--muted)" />
          <polyline
            points={pts
              .map(
                (p) =>
                  `${45 + (p.t / 48) * 505},${155 - ((p.temp + 80) / 115) * 135}`,
              )
              .join(" ")}
            fill="none"
            stroke="var(--ice)"
            strokeWidth="3"
          />
          {[0, 12, 24, 36, 48].map((t) => (
            <text
              x={45 + (t / 48) * 505}
              y="178"
              fill="var(--muted)"
              fontSize="12"
              textAnchor="middle"
              key={t}
            >
              {t} h
            </text>
          ))}
          <text x="2" y="24" fill="var(--muted)" fontSize="12">
            35°C
          </text>
          <text x="0" y="155" fill="var(--muted)" fontSize="12">
            −80°C
          </text>
        </svg>
      )}
      <small>
        0–48-hour scenario · no observations used or gaps interpolated. Zero
        heating, constant ambient, single thermal mass; ventilation, solar gain
        and spatial variation omitted. Model thermal-v1.
      </small>
      <p>
        ±20% heat-loss sensitivity: {n(thermal(tin, tout, target, c, h * 1.2))}–
        {n(thermal(tin, tout, target, c, h * 0.8))} hours. Assumption range, not
        statistical confidence.
      </p>
    </Panel>
  );
}
function Capacity(p: Props) {
  const source = p.d.assets.find((a) => a.code === "GEN-B"),
    target = p.d.assets.find((a) => a.kind === "load");
  const [failed, setFailed] = useState(
      p.d.assets.find((a) => a.code === "GEN-A")?.id || "",
    ),
    [transfer, setTransfer] = useState(true),
    [derating, setDerating] = useState(100),
    [shed, setShed] = useState(0);
  const e = energy(p.d),
    r = capacityPath(
      p.d,
      source?.id || "",
      target?.id || "",
      failed,
      transfer,
      derating,
    );
  return (
    <Panel
      title="Backup capacity & common failures"
      sub="Stored dependency paths + declared source capacity"
    >
      <div className="model-inputs">
        <label>
          Failed asset
          <select value={failed} onChange={(e) => setFailed(e.target.value)}>
            <option value="">No failed asset</option>
            {p.d.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Backup derating assumption · %
          <input
            type="number"
            min="0"
            max="100"
            value={derating}
            onChange={(e) =>
              setDerating(Math.min(100, Math.max(0, +e.target.value)))
            }
          />
        </label>
        <label>
          Load reduction assumption · kW
          <input
            type="number"
            min="0"
            max={e.load?.value || 0}
            value={shed}
            onChange={(event) =>
              setShed(
                Math.min(e.load?.value || 0, Math.max(0, +event.target.value)),
              )
            }
          />
        </label>
      </div>
      <label className="row start">
        <input
          type="checkbox"
          checked={transfer}
          onChange={(e) => setTransfer(e.target.checked)}
        />
        Assume successful manual transfer
      </label>
      <strong className="big-number">
        {n(r.capacity)} <small>kW path ceiling</small>
      </strong>
      <p>{r.reason}</p>
      <div className="dependency-chips">
        {r.path.map((id) => (
          <button
            className="chip"
            key={id}
            onClick={() => p.select(p.d.assets.find((a) => a.id === id)!)}
          >
            {p.d.assets.find((a) => a.id === id)?.code}
          </button>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th>Response assumption</th>
            <th>Unserved requested load · kW</th>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "No transfer", cap: 0, shed: 0 },
            { name: "Backup path only", cap: r.capacity, shed: 0 },
            { name: "Backup + selected load reduction", cap: r.capacity, shed },
          ].map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>
                {n(
                  row.cap === null || e.load?.value == null
                    ? null
                    : Math.max(0, e.load.value - row.shed - row.cap),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Recorded total demand {n(e.load?.value)} kW at{" "}
        {date(e.load?.observed_at)}. Load reduction does not establish which
        circuits can be disconnected. Battery energy is not treated as generator
        power.
      </p>
    </Panel>
  );
}
function ResearchRegister(p: Props) {
  const [busy, setBusy] = useState(false),
    [key, setKey] = useState(randomId());
  const crews = (p.d.operations || []).filter((r) => r.kind === "crew");
  return (
    <Panel
      title="Research continuity register"
      sub="Declared service dependencies and tolerances; no invented experiments"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await mutate(p.d.workspace, p.d.station, "/operations", {
              kind: "research",
              label: f.get("label"),
              data: {
                asset_id: f.get("asset_id"),
                owner_id: f.get("owner_id"),
                interruption_hours: Number(f.get("interruption_hours")),
                note: f.get("note"),
              },
              idempotency_key: key,
            });
            setKey(randomId());
            p.refresh();
            p.notify("Research dependency recorded.");
          } catch (e) {
            p.notify((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        key={key}
      >
        <div className="two-columns">
          <label>
            Experiment / sample store
            <input
              name="label"
              minLength={2}
              maxLength={150}
              required
              placeholder="Illustrative cold-storage study"
            />
          </label>
          <label>
            Responsible crew
            <select name="owner_id" required>
              <option value="">Select a registered crew member</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Required service / asset
            <select name="asset_id" required>
              <option value="">Choose dependency</option>
              {p.d.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Declared interruption tolerance · hours
            <input
              name="interruption_hours"
              type="number"
              min="0"
              max="8760"
              step="0.1"
              defaultValue="1"
              required
            />
          </label>
        </div>
        <label>
          Evidence and conditions
          <textarea name="note" minLength={10} maxLength={2000} required />
        </label>
        <button className="primary" disabled={!p.write || busy}>
          Register dependency
        </button>
      </form>
      {(p.d.operations || [])
        .filter((r) => r.kind === "research")
        .map((r) => {
          const risks = p.d.alerts.filter(
            (a) =>
              !a.recovered &&
              (a.asset_id === r.data.asset_id ||
                affected(p.d, a.asset_id).some(
                  (a) => a.id === r.data.asset_id,
                )),
          );
          return (
            <article className="research-record" key={r.id}>
              <h3>{r.label}</h3>
              <Badge tone={risks.length ? "amber" : "muted"}>
                {risks.length
                  ? "Upstream incident exposure"
                  : "No linked incident recorded"}
              </Badge>
              <p>
                Owner: {crews.find((c) => c.id === r.data.owner_id)?.label} ·
                tolerance {r.data.interruption_hours} hours · {r.origin}
              </p>
              <p>{r.data.note}</p>
              {risks.map((a) => (
                <button
                  className="text-button"
                  key={a.id}
                  onClick={() => p.investigate(a.id)}
                >
                  {a.title}
                </button>
              ))}
            </article>
          );
        })}
    </Panel>
  );
}
function Quality(p: Props) {
  const [filter, setFilter] = useState("all"),
    findings = qualityFindings(p.d),
    list =
      filter === "all" ? findings : findings.filter((f) => f.kind === filter);
  return (
    <Panel
      title="Data-quality workbench"
      sub="Read-only screening · originals and provider flags are preserved"
    >
      <label>
        Finding type
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All findings ({findings.length})</option>
          {[...new Set(findings.map((f) => f.kind))].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <p>
        Rules screen each asset/metric/source series separately. Thresholds are
        documented demonstration heuristics; a flag is not a confirmed sensor
        fault.
      </p>
      <div className="quality-list">
        {list.slice(0, 100).map((f, i) => {
          const m = p.d.measurements.find((m) => m.id === f.id)!;
          return (
            <button
              className="decision-row"
              key={f.id + i}
              onClick={() => p.evidence([f.id])}
            >
              <span>
                <strong>
                  {f.kind} · {m.metric}
                </strong>
                <small>{f.detail}</small>
                <small>
                  {date(m.observed_at)} · {m.origin} · {m.quality}
                </small>
              </span>
              <Badge>
                {n(m.value)} {m.unit}
              </Badge>
            </button>
          );
        })}
        {!list.length && (
          <Empty title="No matching findings">
            An empty result does not validate the sensors or dataset.
          </Empty>
        )}
      </div>
      <small>
        Showing {Math.min(100, list.length)} of {list.length} findings.
      </small>
    </Panel>
  );
}
function Benchmark() {
  const b = benchmark();
  return (
    <Panel
      title="Anomaly baseline experiment"
      sub="120 wholly synthetic samples · no scientific performance claim"
    >
      <p>
        First 80 normal samples establish mean {n(b.mean, 2)} and standard
        deviation {n(b.sd, 2)}. A later 40-sample test set contains four
        declared injected deviations. No test observations tune the threshold.
      </p>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Detected</th>
            <th>Missed</th>
            <th>False alarms</th>
            <th>True negatives</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Fixed threshold >90", b.threshold],
            ["Training mean ±3σ", b.statistical],
          ].map(([name, r]) => (
            <tr key={String(name)}>
              <td>{String(name)}</td>
              {["tp", "fn", "fp", "tn"].map((k) => (
                <td key={k}>{(r as Record<string, number>)[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Notice>
        This is a reproducible statistical benchmark, not a trained Antarctic ML
        model. Injected point anomalies are detected at the same sample or
        missed; there is no measured real-world detection latency.
      </Notice>
      <details>
        <summary>Reproduce the benchmark</summary>
        <p>
          Value(i) = 80 + ((37i mod 17) − 8) × 0.15, i=0…119. Add +12 at indices
          85,103,112 and +5 at 94. Split at 80. Model benchmark-v1. All units
          are arbitrary demonstration units.
        </p>
      </details>
    </Panel>
  );
}
export function Science(p: Props) {
  const [tab, setTab] = useState(
    new URLSearchParams(location.search).get("science") || "quality",
  );
  return (
    <>
      <div className="section-tabs">
        {[
          ["quality", "Data quality"],
          ["models", "Capacity & thermal"],
          ["research", "Research continuity"],
          ["replay", "Incident replay"],
          ["context", "Station geography"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              const u = new URL(location.href);
              u.searchParams.set("science", id);
              history.replaceState({}, "", u);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "quality" ? (
        <>
          <Quality {...p} />
          <Benchmark />
        </>
      ) : tab === "models" ? (
        <div className="two-columns">
          <Capacity {...p} />
          <Thermal />
        </div>
      ) : tab === "research" ? (
        <ResearchRegister {...p} />
      ) : tab === "replay" ? (
        <IncidentReplay {...p} />
      ) : (
        <StationContext station={p.d.station} />
      )}
    </>
  );
}
