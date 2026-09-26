import type { Props } from "./pages";
import { Panel, Badge } from "./components";
import { affected, date, energy, n } from "./model";
import { EvidenceLabel } from "./EvidenceLabel";
import { incidentHandovers } from "./evidenceModel";

export function IncidentSummary(p: Props & { incidentId: string }) {
  const alert = p.d.alerts.find(a => a.id === p.incidentId);
  if (!alert) return null;
  const reading = p.d.measurements.find(m => m.id === alert.measurement_id);
  const work = p.d.work_orders.find(w => w.alert_id === alert.id);
  const resources = energy(p.d);
  const handovers = incidentHandovers(p.d, alert.id);
  const exposed = new Set([alert.asset_id, ...affected(p.d, alert.asset_id).map(a => a.id)]);
  const edges = p.d.edges.filter(e => exposed.has(e.upstream) && exposed.has(e.downstream));
  const name = (id: string) => p.d.assets.find(a => a.id === id)?.name || "Unknown asset";
  const next = alert.status === "open" ? "Acknowledge the warning" : !work ? "Assign a work order" : work.status !== "resolved" ? "Record inspection and resolution" : "Prepare the shift handover";
  function handover() { p.go("operations"); p.setFocus("handover"); }
  return <section className="incident-summary" aria-label="Incident decision summary">
    <div className="incident-next">
      <div><span className="eyebrow">NEXT ACTION</span><h2>{next}</h2><p>Owner: <strong>{work?.assignee || "Not yet assigned"}</strong>{work && ` · Due ${work.due_date}`}</p></div>
      <button className="primary" onClick={() => work?.status === "resolved" ? handover() : document.getElementById("incident-workbench")?.scrollIntoView({ block: "start" })}> {work?.status === "resolved" ? "Open handover" : "Open maintenance actions"}</button>
    </div>
    <EvidenceLabel d={p.d} reading={reading} inspect={() => p.evidence([alert.measurement_id])} />
    <details className="incident-dependencies" open>
      <summary>Registered dependency path · {edges.length} relationships</summary>
      <p>A warning does not confirm an outage. Review each relationship before assessing consequences.</p>
      {edges.length ? <ul>{edges.map(edge => <li key={edge.id}>
        <button className="text-button" onClick={() => p.evidence([edge.id])}>{name(edge.upstream)} → {name(edge.downstream)}</button>
        <Badge tone={edge.verified ? "teal" : "amber"}>{edge.verified ? "Marked verified in record" : "Assumed relationship"}</Badge>
        <span>{edge.relationship}{edge.backup ? " · backup path" : ""}</span>
      </li>)}</ul> : <p>No relationship records. A consequence cannot be inferred.</p>}
      <button onClick={() => { p.go("twin"); p.setFocus(alert.asset_id); }}>Inspect full equipment model</button>
    </details>
    <div className="briefing-grid">
      <Panel title="Resources for this decision">
        <p><strong>{n(resources.autonomy)} days</strong> calculated fuel coverage at the recorded burn rate.</p>
        <p>Burn observed {date(resources.burn?.observed_at)}. Constant-use assumption; a failure can change demand.</p>
        <button className="text-button" onClick={() => p.evidence([resources.fuel?.id, resources.burn?.id].filter(Boolean) as string[])}>Show fuel inputs</button>
        <button onClick={() => p.go("scenarios")}>Compare response options</button>
      </Panel>
      <Panel title="Resolution & handover">
        <p>{work?.resolution || "No resolution notes recorded."}</p>
        <p>{alert.recovered ? "A qualifying recovery reading is recorded." : "Sensor recovery is not recorded. Work completion is a separate state."}</p>
        {handovers.length ? <ul>{handovers.map(h => <li key={h.id}><button className="text-button" onClick={() => p.evidence([h.id])}>{h.label}</button></li>)}</ul> : <p>No saved handover contains a resolved work order for this incident.</p>}
        <button onClick={handover}>Open shift handover</button>
      </Panel>
    </div>
  </section>;
}
