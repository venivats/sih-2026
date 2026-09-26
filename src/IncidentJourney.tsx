import { useState, useEffect } from "react";
import { Play, Pause, Check, MapPin } from "lucide-react";
import type { Props } from "./pages";
import { Panel, Badge, Notice } from "./components";
import { date, n } from "./model";
import { incidentEvents } from "./missionModel";
import { Explanation } from "./Explanation";
export function IncidentJourney(p: Props & { incidentId: string }) {
  const a = p.d.alerts.find((a) => a.id === p.incidentId),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false);
  const events = incidentEvents(p.d, p.incidentId),
    event = events[Math.min(index, events.length - 1)];
  useEffect(() => {
    if (!playing) return;
    if (index >= events.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => i + 1), 1800);
    return () => clearTimeout(t);
  }, [playing, index, events.length]);
  if (!a) return null;
  const order = p.d.work_orders.find((w) => w.alert_id === a.id),
    rule = p.d.rules.find((r) => r.id === a.rule_id),
    m = p.d.measurements.find((m) => m.id === a.measurement_id);
  const steps = [
    ["Warning recorded", true],
    ["Acknowledged", a.status !== "open"],
    ["Owner assigned", !!order?.assignee],
    ["Work resolved", order?.status === "resolved"],
    ["Qualifying recovery reading", a.recovered],
  ] as const;
  return (
    <>
      <ol className="incident-progress">
        {steps.map(([label, done], i) => (
          <li className={done ? "complete" : ""} key={label}>
            {done ? <Check size={18} /> : <b>{i + 1}</b>}
            <span>{label}</span>
          </li>
        ))}
      </ol>
      <div className="mission-toolbar">
        <Explanation
          d={p.d}
          title="Why this incident was flagged"
          formula={`Trigger: ${rule?.metric.replaceAll("_", " ") || "metric"} > ${rule?.threshold ?? "unavailable"} for ${rule?.debounce ?? "unavailable"} consecutive samples.`}
          inputs={[
            {
              label: "Triggering reading",
              value: n(m?.value) + " " + (m?.unit || ""),
            },
            { label: "Observed", value: date(m?.observed_at) },
            {
              label: "Current work owner",
              value: order?.assignee || "Unassigned",
            },
          ]}
          assumptions={[
            rule?.assumption || "Rule evidence unavailable.",
            "A threshold warning is not a confirmed equipment failure.",
            "Recovery follows qualifying readings; work resolution follows recorded inspection.",
          ]}
          ids={[a.measurement_id]}
        />
        <button onClick={() => p.go("field")}>
          <MapPin size={16} /> Crew & field assignment
        </button>
      </div>
      <Panel
        title="Incident replay"
        sub="Chronological record events · replay does not change the live record state"
      >
        {event && (
          <>
            <div className="replay-current">
              <Badge>{event.kind}</Badge>
              <h3>{event.title}</h3>
              <p>{date(event.at)}</p>
              <p className="event-detail">{event.detail}</p>
            </div>
            <div className="replay-controls">
              <button
                aria-label={playing ? "Pause replay" : "Play replay"}
                onClick={() => {
                  if (index >= events.length - 1) setIndex(0);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <label>
                Event {Math.min(index + 1, events.length)} of {events.length}
                <input
                  type="range"
                  aria-label="Incident event"
                  min="0"
                  max={Math.max(0, events.length - 1)}
                  value={Math.min(index, events.length - 1)}
                  onChange={(e) => {
                    setPlaying(false);
                    setIndex(Number(e.target.value));
                  }}
                />
              </label>
            </div>
            <ol className="incident-timeline">
              {events.map((r, i) => (
                <li key={r.id}>
                  <button
                    aria-current={i === index ? "step" : undefined}
                    onClick={() => {
                      setIndex(i);
                      setPlaying(false);
                    }}
                  >
                    <time>{date(r.at)}</time>
                    <strong>{r.title}</strong>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </Panel>
    </>
  );
}
