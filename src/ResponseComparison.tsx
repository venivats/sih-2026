import { useState, useRef } from "react";
import { GitCompareArrows, Download } from "lucide-react";
import type { Props } from "./pages";
import { Panel, Badge, Notice, Empty } from "./components";
import { compareFuel } from "./missionModel";
import { energy, n, date } from "./model";
import { Explanation } from "./Explanation";
import { randomId } from "./id";
import { mutate } from "./api";
import { canWrite } from "./permissions";
export function ResponseComparison(p: Props) {
  const e = energy(p.d),
    [burn, setBurn] = useState(e.burn?.value || 0),
    [delay, setDelay] = useState(0),
    [reserve, setReserve] = useState(0),
    [name, setName] = useState("Response option"),
    [note, setNote] = useState(
      "Constant consumption assumption; feasibility and affected activities require operator review.",
    ),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(randomId());
  const result = compareFuel(p.d, burn, delay, reserve),
    saved = (p.d.operations || []).filter((r) => r.kind === "comparison");
  const pending = useRef<Record<string, unknown> | null>(null);
  const change = () => {
    pending.current = null;
    setKey(randomId());
  };
  function exportData(value: unknown) {
    const a = document.createElement("a"),
      u = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
      );
    a.href = u;
    a.download = "polaris-response-comparison.json";
    a.click();
    URL.revokeObjectURL(u);
  }
  const record = () => ({
    workspace: p.d.workspace,
    station: p.d.station,
    captured_at: new Date().toISOString(),
    model: "constant-burn-comparison-v1",
    result,
    inputs: {
      measurements: p.d.measurements.filter((m) => m.id === e.burn?.id),
      inventory: e.fuel ? [e.fuel] : [],
      shipments: result.available ? [result.ship] : [],
      sources: p.d.sources,
    },
  });
  return (
    <Panel
      title="Compare response options"
      sub="Baseline versus an explicit alternative · original measurements and shipments stay unchanged"
      className="response-comparison"
    >
      <div className="mission-form">
        <label>
          Alternative consumption (L/day)
          <input
            type="number"
            min="0.1"
            max="100000"
            step="0.1"
            value={burn}
            onChange={(x) => {
              setBurn(Number(x.target.value));
              change();
            }}
          />
        </label>
        <label>
          Additional arrival delay (days)
          <input
            type="number"
            min="0"
            max="365"
            value={delay}
            onChange={(x) => {
              setDelay(Number(x.target.value));
              change();
            }}
          />
        </label>
        <label>
          Declared fuel reserve (L)
          <input
            type="number"
            min="0"
            max="10000000"
            value={reserve}
            onChange={(x) => {
              setReserve(Number(x.target.value));
              change();
            }}
          />
        </label>
      </div>
      {result.available ? (
        <>
          <div className="comparison-pair">
            {[
              {
                label: "Recorded baseline",
                burn: result.baselineBurn,
                days: result.baselineDays,
                gap: result.baselineGap,
                margin: result.baselineMargin,
                eta: result.days,
              },
              {
                label: name || "Alternative",
                burn: result.dailyBurn,
                days: result.alternativeDays,
                gap: result.alternativeGap,
                margin: result.alternativeMargin,
                eta: result.days + delay,
              },
            ].map((r, i) => (
              <article className={i ? "alternative" : ""} key={i}>
                <span className="eyebrow">{r.label}</span>
                <strong>
                  {n(r.days)} <small>days to reserve</small>
                </strong>
                <p>
                  {n(r.burn)} L/day · arrival after {n(r.eta)} days
                </p>
                <dl>
                  <dt>Projected balance above reserve at arrival</dt>
                  <dd>{n(r.margin)} L</dd>
                  <dt>Coverage gap</dt>
                  <dd>{n(r.gap)} days</dd>
                </dl>
                <Badge tone={r.margin < 0 ? "amber" : "teal"}>
                  {r.margin < 0 ? "Shortfall to review" : "Modelled coverage"}
                </Badge>
              </article>
            ))}
          </div>
          <p>
            Time horizon begins at the burn observation: {date(result.at)}.
            Shipment: {result.ship?.name}. A negative balance expresses a
            modelled shortfall, not negative physical stock.
          </p>
          <Explanation
            d={p.d}
            title="Fuel response comparison"
            formula="Days to reserve = max(0, inventory − reserve) ÷ daily burn. Margin at arrival = inventory − burn × days to arrival − reserve."
            inputs={[
              { label: "Recorded inventory", value: n(result.fuel) + " L" },
              { label: "Alternative burn", value: n(burn) + " L/day" },
              { label: "Additional delay", value: n(delay) + " days" },
              { label: "Declared reserve", value: n(reserve) + " L" },
            ]}
            assumptions={[
              "Consumption remains constant; no weather-driven arrival forecast.",
              "The inventory balance and burn observation may represent different times. Reconcile them before operational use.",
              "A lower burn assumption does not establish which equipment can be curtailed.",
              "Backup readiness, load priorities and approval require separate review.",
            ]}
            ids={result.lineage}
          />
          <form
            className="mission-form"
            onSubmit={async (ev) => {
              ev.preventDefault();
              setBusy(true);
              try {
                pending.current ??= {
                  kind: "comparison",
                  label: name,
                  data: {
                    snapshot: record(),
                    daily_burn: burn,
                    delay_days: delay,
                    reserve_litres: reserve,
                    note,
                  },
                  idempotency_key: key,
                };
                await mutate(
                  p.d.workspace,
                  p.d.station,
                  "/operations",
                  pending.current,
                );
                await p.refresh();
                p.notify(
                  "Named comparison saved with a frozen input snapshot.",
                );
              } catch (e) {
                p.notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Comparison name
              <input
                required
                minLength={2}
                maxLength={150}
                value={name}
                onChange={(x) => {
                  setName(x.target.value);
                  change();
                }}
              />
            </label>
            <label>
              Prerequisites / trade-offs
              <textarea
                required
                minLength={10}
                maxLength={2000}
                value={note}
                onChange={(x) => {
                  setNote(x.target.value);
                  change();
                }}
              />
            </label>
            <div className="actions">
              <button
                className="primary"
                disabled={!p.write || !canWrite(p.role, "operations") || busy}
              >
                {busy ? "Saving…" : "Save named comparison"}
              </button>
              <button
                type="button"
                onClick={() => exportData({ ...record(), name, note })}
              >
                <Download size={15} /> Export comparison
              </button>
            </div>
          </form>
        </>
      ) : (
        <Empty title="Comparison unavailable">{result.reason}</Empty>
      )}
      {!!saved.length && (
        <details className="mission-details">
          <summary>Saved comparisons ({saved.length})</summary>
          {saved.map((r) => (
            <article key={r.id} className="field-event">
              <h3>{r.label}</h3>
              <p>{r.data.note}</p>
              <p>
                Captured {date(r.created_at)} · alternative{" "}
                {n(r.data.daily_burn)} L/day · delay {n(r.data.delay_days)} days
              </p>
              <button onClick={() => exportData(r)}>
                Export preserved inputs and result
              </button>
              <button onClick={() => p.evidence([r.id])}>
                View saved record
              </button>
            </article>
          ))}
        </details>
      )}
    </Panel>
  );
}
