import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { useState } from "react";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import { Panel, Badge, Notice, Empty } from "./components";
import type { Props } from "./pages";
import { n, date } from "./model";
import {
  seriesGroups,
  robustBaseline,
  fuelTrend,
  ANALYSIS_VERSION,
  accepted,
} from "./analysisModel";
export function RecordedAnalysis(p: Props) {
  const groups = seriesGroups(p.d),
    [selected, setSelected] = useState(""),
    [window, setWindow] = useState(20),
    [threshold, setThreshold] = useState(3.5);
  const group =
    groups.find((g) => g.key === selected) ||
    groups.find((g) => g.rows[0].metric === "coolant_temperature") ||
    groups[0];
  const result = robustBaseline(group?.rows || [], window, threshold);
  const m = result.current;
  return (
    <Panel
      title="Recorded-signal analysis"
      sub="Explainable statistical screening · each source stays separate"
      action={
        <Badge>
          <FlaskConical size={13} /> {ANALYSIS_VERSION}
        </Badge>
      }
    >
      <div className="analysis-controls">
        <label>
          Signal
          <select
            value={group?.key || ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.asset?.code || "Asset"} · {g.rows[0].metric} ·{" "}
                {g.rows[0].origin}
              </option>
            ))}
          </select>
        </label>
        <label>
          Preceding samples
          <select value={window} onChange={(e) => setWindow(+e.target.value)}>
            {[12, 20, 30, 60].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Review threshold · |z|
          <input
            type="number"
            min="2"
            max="8"
            step=".5"
            value={threshold}
            onChange={(e) =>
              setThreshold(Math.min(8, Math.max(2, +e.target.value)))
            }
          />
        </label>
      </div>
      {m ? (
        <>
          <div className="analysis-summary">
            <div>
              <span className="eyebrow">LATEST RECORDED SAMPLE</span>
              <strong>
                {n(m.value)} <small>{m.unit}</small>
              </strong>
              <span>{date(m.observed_at)}</span>
            </div>
            <div>
              <span className="eyebrow">MODIFIED Z-SCORE</span>
              <strong className={result.flag ? "amber-text" : ""}>
                {n(result.score, 2)}
              </strong>
              <Badge tone={result.flag ? "amber" : "muted"}>
                {result.status !== "calculated"
                  ? "Insufficient baseline"
                  : result.flag
                    ? "Deviation · review evidence"
                    : "Within selected band"}
              </Badge>
            </div>
            <div>
              <span className="eyebrow">BASELINE BAND</span>
              <strong>
                {n(result.low)}–{n(result.high)}
              </strong>
              <span>
                {m.unit} · {result.count} valid preceding samples
              </span>
            </div>
          </div>
          <div
            className="recorded-chart"
            role="img"
            aria-label={
              "Recorded " +
              m.metric +
              " in " +
              m.unit +
              ", with missing values shown as gaps"
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={group!.rows
                  .slice(-(window + 1))
                  .map((v) => ({
                    time: v.observed_at,
                    value: accepted(v) ? v.value : null,
                  }))}
                margin={{ top: 15, right: 25, left: 5, bottom: 10 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickFormatter={(v) =>
                    Number.isFinite(Date.parse(v))
                      ? new Date(v).toISOString().slice(11, 16)
                      : "Invalid time"
                  }
                  minTickGap={45}
                  stroke="var(--muted)"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  width={65}
                  stroke="var(--muted)"
                />
                <Tooltip
                  labelFormatter={(v) => date(String(v))}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                />
                <Line
                  name={m.unit}
                  type="linear"
                  dataKey="value"
                  stroke="var(--ice)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {result.median !== null && (
                  <ReferenceLine
                    y={result.median}
                    stroke="var(--teal)"
                    strokeDasharray="4 4"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <small>
            Horizontal axis: UTC observation time · vertical axis: {m.unit}.
            Window {date(group!.rows.slice(-(window + 1))[0]?.observed_at)} →{" "}
            {date(m.observed_at)}. Dashed line: preceding-sample median. Missing
            or quality-flagged values break the trace. Lines connect recorded
            samples; the analysis rejects large time gaps.
          </small>
          <p>{result.reason}</p>
          <div className="analysis-provenance">
            <Badge>{m.origin}</Badge>
            <span>
              {result.excluded} excluded samples · observation time above; no
              live status inferred
            </span>
            <button
              className="text-button"
              onClick={() => p.evidence(result.ids)}
            >
              Inspect baseline and current evidence <ArrowUpRight size={14} />
            </button>
          </div>
          <details>
            <summary>Recorded samples and quality</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Observed · UTC</th>
                    <th>Value · {m.unit}</th>
                    <th>Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {group!.rows.slice(-(window + 1)).map((v) => (
                    <tr key={v.id}>
                      <td>{date(v.observed_at)}</td>
                      <td>{n(v.value)}</td>
                      <td>
                        {v.quality}
                        {accepted(v) ? "" : " · excluded"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>Method, interpretation and limits</summary>
            <p>
              Score = 0.6745 × (current − median) / median absolute deviation.
              Band = median ± threshold × MAD / 0.6745. This adapts modified
              z-score screening to a preceding-sample window; the window and
              threshold are assumptions. Trend, seasonality, autocorrelation and
              regime changes can cause flags. A zero MAD produces an unavailable
              score, not infinity or a fabricated result.
            </p>
            <p>
              Threshold alerts remain authoritative within their configured
              demonstration rules. This screening does not acknowledge alerts,
              change sensor flags, assign diagnoses or create work
              automatically.
            </p>
            <a
              href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm"
              target="_blank"
              rel="noreferrer"
            >
              NIST: detection of potential outliers ↗
            </a>
          </details>
        </>
      ) : (
        <Empty title="No recorded signal to analyse">
          Import or acquire a time series with source evidence. No mathematical
          substitute is generated.
        </Empty>
      )}
    </Panel>
  );
}
export function FuelForecast(p: Props) {
  const r = fuelTrend(p.d);
  return (
    <Panel
      title="Fuel outlook from recorded history"
      sub="Up to 30 days · minimum 7 recorded days · current ledger stock"
    >
      <div className="analysis-summary">
        <div>
          <span className="eyebrow">BASELINE AUTONOMY</span>
          <strong>
            {n(r.days)} <small>days</small>
          </strong>
          <span>At average recorded daily burn</span>
        </div>
        <div>
          <span className="eyebrow">HISTORICAL RATE SENSITIVITY</span>
          <strong>
            {r.range ? `${n(r.range[0])}–${n(r.range[1])}` : "—"}{" "}
            <small>days</small>
          </strong>
          <span>10th–90th burn-rate percentiles</span>
        </div>
        <div>
          <span className="eyebrow">DATA COVERAGE</span>
          <strong>
            {r.count} <small>days</small>
          </strong>
          <span>Latest input {date(r.asOf)}</span>
        </div>
      </div>
      <Notice tone={r.days === null ? "amber" : "muted"}>{r.reason}</Notice>
      <div className="actions">
        <button
          className="small-button"
          disabled={!r.ids.length}
          onClick={() => p.evidence(r.ids)}
        >
          Trace stock and burn inputs
        </button>
      </div>
      <details>
        <summary>Recorded daily averages · L/day</summary>
        <table>
          <thead>
            <tr>
              <th>UTC day</th>
              <th>Sample-average rate · L/day</th>
            </tr>
          </thead>
          <tbody>
            {r.daily.map((v) => (
              <tr key={v.day}>
                <td>{v.day}</td>
                <td>{n(v.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Irregular sampling may bias daily averages. Unknown days remain
          missing. Historical data does not establish current station conditions
          or a calibrated forecast.
        </p>
      </details>
    </Panel>
  );
}
