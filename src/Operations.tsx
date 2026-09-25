import { canWrite } from "./permissions";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Ship,
  Wind,
  Users,
  Radio,
  FileText,
  MessageCircle,
  CheckCircle,
} from "lucide-react";
import type { Props } from "./pages";
import type { OpsRecord } from "./types";
import { Panel, Badge, Notice, Empty } from "./components";
import { mutate } from "./api";
import { randomId } from "./id";
import { n, date } from "./model";
import {
  resupply,
  weather,
  baseline,
  decisions,
  handover,
  stationAnswer,
  crewAvailable,
} from "./operationsModel";

export function ResupplyCoverage(p: Props) {
  const [extra, setExtra] = useState(0),
    [margin, setMargin] = useState(7),
    r = resupply(p.d, extra, margin);
  return (
    <Panel
      title="Resupply & resource coverage"
      sub="Shipment ETA and ledger stock · constant-burn estimate"
    >
      <div className="resupply-grid">
        <div>
          <Ship size={23} />
          <span className="eyebrow">EXPECTED ARRIVAL</span>
          <strong className="big-number">
            {n(r.days)} <small>days</small>
          </strong>
          <p>After fuel-burn baseline {date(r.at)}</p>
          {r.ship ? (
            <button
              className="text-button"
              onClick={() => p.detail?.("shipments", r.ship!.id)}
            >
              {r.ship.name} · {r.ship.status} <ArrowRight size={14} />
            </button>
          ) : (
            <p>Shipment unavailable</p>
          )}
        </div>
        <div>
          <span className="eyebrow">FUEL AT ARRIVAL</span>
          <strong
            className={
              "big-number " + ((r.remaining ?? 0) < 0 ? "amber-text" : "")
            }
          >
            {n(r.remaining, 0)} <small>L</small>
          </strong>
          <p>
            {r.gap === null
              ? "Coverage cannot be assessed"
              : r.gap > 0
                ? `${n(r.gap)} days below arrival + ${margin}-day reserve`
                : "Covers the assumed arrival and reserve period"}
          </p>
          <button className="text-button" onClick={() => p.evidence(r.lineage)}>
            Trace calculation inputs
          </button>
        </div>
      </div>
      <div className="two-columns">
        <label>
          Additional delay assumption · days
          <input
            type="range"
            min="0"
            max="90"
            value={extra}
            onChange={(e) => setExtra(+e.target.value)}
          />
          <span>{extra} days</span>
        </label>
        <label>
          Reserve margin assumption · days
          <input
            type="number"
            min="0"
            max="180"
            value={margin}
            onChange={(e) =>
              setMargin(Math.min(180, Math.max(0, +e.target.value)))
            }
          />
        </label>
      </div>
      {r.ship && (
        <small>
          Recorded ETA {date(r.ship.eta)} · {r.ship.risk}. ETA is not a
          confirmed arrival or verified seasonal access window.
        </small>
      )}
      <div className="actions">
        <button
          className="small-button"
          disabled={r.days === null}
          onClick={() =>
            p.scenario?.({
              failure: "none",
              delay_days: r.days || 0,
              demand_increase: 0,
              shed_kw: 0,
              backup_kw: 0,
            })
          }
        >
          Compare response options <ArrowRight size={14} />
        </button>
      </div>
    </Panel>
  );
}

export function DecisionCentre(p: Props) {
  const list = decisions(p.d);
  return (
    <Panel
      title="Decisions needed"
      sub="Ranked by declared severity, dependency reach and resource exposure"
    >
      <div className="decision-list">
        {list.length ? (
          list.slice(0, 5).map((v, i) => (
            <button
              key={v.id}
              className="decision-row"
              onClick={() =>
                v.kind === "alert"
                  ? p.investigate(v.id)
                  : v.kind === "resupply"
                    ? p.go("logistics")
                    : p.go("operations")
              }
            >
              <span className="decision-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{v.title}</strong>
                <small>{v.reason}</small>
                <small>Owner: {v.owner}</small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))
        ) : (
          <Empty title="No ranked decisions available">
            Absent alerts do not establish station health. Check data coverage.
          </Empty>
        )}
      </div>
      <details>
        <summary>How priorities are ranked</summary>
        <p>
          Critical alert: 100 points; other unrecovered alert: 60, plus one per
          reachable dependency. Fuel gap: 80. Outdoor threshold breach: 90;
          unavailable weather: 70; planned task: 20. These are transparent
          prototype priorities, not risk probabilities.
        </p>
      </details>
    </Panel>
  );
}

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Handover(p: Props) {
  p = { ...p, write: p.write && canWrite(p.role, "handover") };
  const [report, setReport] = useState<ReturnType<typeof handover> | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(randomId());
  return (
    <Panel
      title="Shift handover"
      sub="Deterministic narrative · traceable facts · no model credentials needed"
    >
      <p>
        Generate a frozen report from the selected workspace. Later changes do
        not rewrite its evidence snapshot.
      </p>
      <button
        className="primary"
        onClick={() => {
          setReport(handover(p.d));
          setKey(randomId());
        }}
      >
        <FileText size={17} /> Generate shift handover
      </button>
      {report && (
        <div className="report-output">
          <Badge>Snapshot captured</Badge>
          <h3>Changes since the previous saved handover</h3>
          <p>
            {report.changes.previous
              ? "Compared with " + report.changes.previous.label
              : "First preserved baseline"}
          </p>
          <ul>
            {report.changes.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <h3>Current state and unresolved actions</h3>
          <p>{report.text}</p>
          <small>Generated {date(report.generated_at)} · handover-v1</small>
          <div className="actions">
            <button
              className="small-button"
              onClick={() => download("polaris-handover.json", report)}
            >
              Export with inputs
            </button>
            <button
              className="small-button"
              onClick={() => p.evidence(report.lineage as string[])}
            >
              Inspect evidence
            </button>
            <button
              className="small-button"
              disabled={!p.write || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await mutate(p.d.workspace, p.d.station, "/operations", {
                    kind: "handover",
                    label: "Shift handover " + report.generated_at,
                    data: {
                      text: report.text,
                      snapshot: report,
                      model_version: "handover-v1",
                    },
                    idempotency_key: key,
                  });
                  p.refresh();
                  p.notify("Handover snapshot saved.");
                } catch (e) {
                  p.notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save reviewed handover
            </button>
          </div>
        </div>
      )}
      {(p.d.operations || [])
        .filter((r) => r.kind === "handover")
        .map((r) => (
          <details key={r.id}>
            <summary>{r.label}</summary>
            <p>{r.data.text}</p>
            <button
              className="text-button"
              onClick={() => download("saved-handover.json", r)}
            >
              Download preserved report
            </button>
          </details>
        ))}
    </Panel>
  );
}
export function StationQuestions(p: Props) {
  const [question, setQuestion] = useState(""),
    [answers, setAnswers] = useState<
      { q: string; a: ReturnType<typeof stationAnswer> }[]
    >([]);
  function ask(q: string) {
    if (!q.trim()) return;
    setAnswers((v) => [...v.slice(-7), { q, a: stationAnswer(p.d, q) }]);
    setQuestion("");
  }
  return (
    <Panel
      title="Ask about this station"
      sub="Record-backed answers · supported questions, not a general chatbot"
    >
      <div className="question-suggestions">
        {[
          "How much fuel remains?",
          "Will fuel last until resupply?",
          "Which alerts need attention?",
          "Summarize this shift",
        ].map((q) => (
          <button className="chip" key={q} onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="chat-records" aria-live="polite">
        {answers.map((r, i) => (
          <article key={i}>
            <strong>
              <MessageCircle size={14} /> {r.q}
            </strong>
            <p>{r.a.text}</p>
            <small>
              {r.a.station} · {r.a.workspace} · reference {date(r.a.at)}
            </small>
            {r.a.ids.length > 0 && (
              <button
                className="text-button"
                onClick={() => p.evidence(r.a.ids)}
              >
                Evidence ({r.a.ids.length} records)
              </button>
            )}
          </article>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label>
          Your question
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Ask about fuel, power, alerts, weather or handover…"
          />
        </label>
        <button className="primary">Ask station</button>
      </form>
    </Panel>
  );
}

function NextContact({ d }: Props) {
  const at = baseline(d),
    records = (d.operations || []).filter(
      (r) => r.kind === "contact" && r.data.status === "planned",
    );
  const next = at
    ? records
        .filter((r) => Date.parse(r.data.ends_at) >= Date.parse(at))
        .sort(
          (a, b) => Date.parse(a.data.starts_at) - Date.parse(b.data.starts_at),
        )[0]
    : undefined;
  const mins =
    next && at
      ? Math.max(0, (Date.parse(next.data.starts_at) - Date.parse(at)) / 60000)
      : null;
  return (
    <Panel
      title="Next planned contact"
      sub="Operator-entered schedule · no orbital or link measurement"
    >
      <strong className="big-number">
        {mins === null
          ? "Unavailable"
          : mins === 0
            ? "In planned window"
            : n(mins / 60) + " h"}{" "}
      </strong>
      <p>
        {next
          ? next.label +
            " · " +
            date(next.data.starts_at) +
            " → " +
            date(next.data.ends_at)
          : "No upcoming contact is registered relative to this workspace baseline."}
      </p>
      <small>
        Reference {date(at)} ·{" "}
        {d.workspace === "operational"
          ? "current clock"
          : "historical demonstration clock; not live"}
        . Contact availability is unconfirmed until recorded by a person.
      </small>
    </Panel>
  );
}

export function Operations(p: Props) {
  const [tab, setTab] = useState(
      p.focus === "handover"
        ? "brief"
        : new URLSearchParams(location.search).get("tab") || "crew",
    ),
    [editing, setEditing] = useState<OpsRecord | null>(null),
    [busy, setBusy] = useState(false),
    [storm, setStorm] = useState(false),
    [key, setKey] = useState(randomId());
  useEffect(() => {
    if (p.focus === "handover") {
      setTab("brief");
      p.setFocus("");
    }
  }, [p.focus]);
  const records = p.d.operations || [],
    crews = records.filter((r) => r.kind === "crew"),
    at = baseline(p.d) || new Date().toISOString();
  const kinds: Record<string, OpsRecord["kind"]> = {
    crew: "crew",
    outdoors: "outdoor_task",
    contacts: "contact",
    brief: "handover",
  };
  const tabs = [
    ["crew", "Crew & duties", Users],
    ["outdoors", "Outdoor operations", Wind],
    ["contacts", "Contact schedule", Radio],
    ["brief", "Handover", FileText],
  ] as const;
  function change(t: string) {
    setTab(t);
    setEditing(null);
    setKey(randomId());
    const u = new URL(location.href);
    u.searchParams.set("tab", t);
    history.replaceState({}, "", u);
  }
  p = {
    ...p,
    write:
      p.write && canWrite(p.role, tab === "brief" ? "handover" : "operations"),
  };
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      kind = kinds[tab];
    const fields = Object.fromEntries(f.entries());
    const label = String(fields.label);
    delete fields.label;
    let data: Record<string, any> = { ...fields };
    for (const k of [
      "shift_start",
      "shift_end",
      "scheduled_at",
      "starts_at",
      "ends_at",
    ])
      if (k in data) data[k] = new Date(data[k] + "Z").toISOString();
    if ("wind_limit_ms" in data)
      data.wind_limit_ms = Number(data.wind_limit_ms);
    if ("shipment_id" in data) data.shipment_id = data.shipment_id || null;
    setBusy(true);
    try {
      await mutate(
        p.d.workspace,
        p.d.station,
        editing ? "/operations/" + editing.id : "/operations",
        editing
          ? { version: editing.version, data }
          : { kind, label, data, idempotency_key: key },
        editing ? "PATCH" : "POST",
      );
      setEditing(null);
      setKey(randomId());
      p.refresh();
      p.notify("Scoped record saved.");
    } catch (e) {
      p.notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dt = (s: string) => s.slice(0, 16),
    end = new Date(Date.parse(at) + 86400000).toISOString();
  return (
    <>
      <div
        className="section-tabs"
        role="tablist"
        aria-label="Operations registers"
      >
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => change(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      {!p.write && (
        <Notice>
          Your current workspace or role does not permit changes in this
          register. Start a private demonstration or ask the administrator for
          the appropriate team role.
        </Notice>
      )}
      {tab === "brief" ? (
        <div className="two-columns">
          <Handover {...p} />
          <StationQuestions {...p} />
        </div>
      ) : (
        <div className="register-layout">
          <Panel
            title={
              editing
                ? "Edit record"
                : "Register " +
                  (tab === "crew"
                    ? "crew member"
                    : tab === "contacts"
                      ? "contact session"
                      : "outdoor activity")
            }
            sub={
              p.d.workspace === "operational"
                ? "Manual entries · unverified"
                : "Fictional training records only"
            }
          >
            <form key={key + (editing?.id || "")} onSubmit={save}>
              <label>
                {tab === "crew" ? "Display name" : "Activity / session name"}
                <input
                  name="label"
                  defaultValue={editing?.label}
                  required
                  minLength={2}
                  maxLength={150}
                  readOnly={!!editing}
                  placeholder={
                    tab === "crew" ? "Demo engineer" : "Planned activity"
                  }
                />
              </label>
              {tab === "crew" ? (
                <>
                  <label>
                    Role
                    <input
                      name="role"
                      defaultValue={editing?.data.role || "Station engineer"}
                      required
                      minLength={2}
                    />
                  </label>
                  <label>
                    Availability
                    <select
                      name="status"
                      defaultValue={editing?.data.status || "on_duty"}
                    >
                      <option value="on_duty">On duty</option>
                      <option value="off_duty">Off duty</option>
                      <option value="rotation_due">Rotation due</option>
                    </select>
                  </label>
                  <label>
                    Duty starts · UTC
                    <input
                      type="datetime-local"
                      name="shift_start"
                      defaultValue={dt(editing?.data.shift_start || at)}
                      required
                    />
                  </label>
                  <label>
                    Duty ends · UTC
                    <input
                      type="datetime-local"
                      name="shift_end"
                      defaultValue={dt(editing?.data.shift_end || end)}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Responsible crew
                    <select
                      name="assignee_id"
                      required
                      defaultValue={editing?.data.assignee_id || ""}
                    >
                      <option value="">Select crew member</option>
                      {crews.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {tab === "outdoors" ? (
                    <>
                      <label>
                        Scheduled time · UTC
                        <input
                          type="datetime-local"
                          name="scheduled_at"
                          defaultValue={dt(editing?.data.scheduled_at || at)}
                          required
                        />
                      </label>
                      <label>
                        Wind review threshold · m/s (assumption)
                        <input
                          type="number"
                          name="wind_limit_ms"
                          step="0.1"
                          min="0.1"
                          max="100"
                          defaultValue={editing?.data.wind_limit_ms || 20}
                          required
                        />
                      </label>
                      <label>
                        Linked shipment
                        <select
                          name="shipment_id"
                          defaultValue={editing?.data.shipment_id || ""}
                        >
                          <option value="">No shipment</option>
                          {p.d.shipments.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        Contact starts · UTC
                        <input
                          type="datetime-local"
                          name="starts_at"
                          defaultValue={dt(editing?.data.starts_at || at)}
                          required
                        />
                      </label>
                      <label>
                        Contact ends · UTC
                        <input
                          type="datetime-local"
                          name="ends_at"
                          defaultValue={dt(editing?.data.ends_at || end)}
                          required
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Status
                    <select
                      name="status"
                      defaultValue={editing?.data.status || "planned"}
                    >
                      <option value="planned">Planned</option>
                      <option value={tab === "outdoors" ? "on_hold" : "missed"}>
                        {tab === "outdoors" ? "On hold" : "Missed"}
                      </option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                  <label>
                    Evidence / review notes
                    <textarea
                      name="note"
                      required
                      minLength={10}
                      maxLength={2000}
                      defaultValue={editing?.data.note}
                      placeholder="Basis for schedule, threshold and human review…"
                    />
                  </label>
                </>
              )}
              <button className="primary" disabled={!p.write || busy}>
                {busy ? "Saving…" : "Save record"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditing(null)}
                >
                  Cancel editing
                </button>
              )}
            </form>
          </Panel>
          <div>
            {tab === "contacts" && <NextContact {...p} />}{" "}
            {tab === "outdoors" && (
              <Panel title="Outdoor weather review">
                <label className="row start">
                  <input
                    type="checkbox"
                    checked={storm}
                    onChange={(e) => setStorm(e.target.checked)}
                  />
                  Apply 130 km/h wind assumption to this view
                </label>
                <Notice>
                  Scenario view only. No measurements, task status or shipment
                  ETA change automatically. Below a threshold is not safety
                  clearance.
                </Notice>
                <button
                  className="small-button"
                  onClick={() => {
                    const r = resupply(p.d, 45);
                    p.scenario?.({
                      failure: "none",
                      delay_days: r.days || 45,
                      demand_increase: 0,
                      shed_kw: 0,
                      backup_kw: 0,
                    });
                  }}
                >
                  Explicitly evaluate +45-day resupply delay
                </button>
              </Panel>
            )}
            {records.filter((r) => r.kind === kinds[tab]).length === 0 && (
              <Panel>
                <Empty title="No records registered">
                  Create a scoped record using the form. Nothing is seeded into
                  the operational workspace.
                </Empty>
              </Panel>
            )}
            {records
              .filter((r) => r.kind === kinds[tab])
              .map((r) => {
                const w =
                  r.kind === "outdoor_task"
                    ? weather(
                        p.d,
                        r.data.wind_limit_ms,
                        storm ? 130 / 3.6 : undefined,
                      )
                    : null;
                const c = crews.find((c) => c.id === r.data.assignee_id);
                return (
                  <Panel
                    key={r.id}
                    title={r.label}
                    action={
                      <Badge
                        tone={r.data.status === "on_hold" ? "amber" : "muted"}
                      >
                        {r.data.status?.replaceAll("_", " ")}
                      </Badge>
                    }
                  >
                    <small>
                      {r.origin} · version {r.version} · {r.id.slice(0, 8)}
                    </small>
                    {r.kind === "crew" ? (
                      <>
                        <p>{r.data.role}</p>
                        <p>
                          {date(r.data.shift_start)} → {date(r.data.shift_end)}
                        </p>
                        {p.d.work_orders
                          .filter((w) => w.status !== "resolved")
                          .map((w) => (
                            <div className="row" key={w.id}>
                              <span>
                                {w.title} · {w.assignee}
                                <small> Due {w.due_date}</small>
                              </span>
                              <button
                                className="small-button"
                                disabled={
                                  !p.write ||
                                  busy ||
                                  r.data.status !== "on_duty"
                                }
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await mutate(
                                      p.d.workspace,
                                      p.d.station,
                                      "/work-orders/" + w.id + "/assign-crew",
                                      {
                                        crew_id: r.id,
                                        notes:
                                          "Duty roster assignment reviewed by operator",
                                      },
                                    );
                                    p.refresh();
                                    p.notify("Work order reassigned.");
                                  } catch (e) {
                                    p.notify((e as Error).message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                Assign
                              </button>
                            </div>
                          ))}
                      </>
                    ) : (
                      <>
                        <p>
                          Owner: {c?.label || "Unavailable"} ·{" "}
                          {c &&
                          crewAvailable(
                            c,
                            r.data.scheduled_at || r.data.starts_at,
                          )
                            ? "within duty period"
                            : "availability conflict"}
                        </p>
                        <p>
                          {date(r.data.scheduled_at || r.data.starts_at)}{" "}
                          {r.data.ends_at && "→ " + date(r.data.ends_at)}
                        </p>
                        <p>{r.data.note}</p>
                      </>
                    )}
                    {w && (
                      <div className="weather-assessment">
                        <Badge tone={w.state === "below" ? "muted" : "amber"}>
                          {w.state === "review"
                            ? "Threshold exceeded — review activity"
                            : w.state === "unknown"
                              ? "Unable to assess"
                              : "Below wind threshold"}
                        </Badge>
                        <p>
                          {n(w.value)} m/s · threshold {r.data.wind_limit_ms}{" "}
                          m/s
                        </p>
                        <small>
                          {w.reason} · {date(w.at)}
                        </small>
                        <button
                          className="text-button"
                          onClick={() => p.evidence(w.ids)}
                        >
                          Weather evidence
                        </button>
                      </div>
                    )}
                    {r.kind === "contact" && (
                      <small>
                        Planned human contact, not a computed satellite pass. A
                        completed record requires the operator's contact
                        evidence.
                      </small>
                    )}
                    <button
                      className="text-button"
                      disabled={!p.write}
                      onClick={() => setEditing(r)}
                    >
                      Edit record
                    </button>
                    <details>
                      <summary>Audit history</summary>
                      {p.d.audit
                        .filter((a) => a.entity_id === r.id)
                        .map((a) => (
                          <p key={a.id}>
                            {date(a.created_at)} · {a.action} · {a.actor}
                          </p>
                        ))}
                    </details>
                  </Panel>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}
