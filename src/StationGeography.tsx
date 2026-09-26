import { StationContext } from "./StationContext";
import { ResearchEvidence } from "./ResearchEvidence";
import { Panel, Notice } from "./components";
import type { Props } from "./pages";
export function StationGeography(p: Props) {
  return <div className="mission-workspace"><p className="eyebrow">ANTARCTICA / STATION CONTEXT</p><StationContext station={p.d.station} /><div className="two-columns"><Panel title="Crew exercise layer"><p>Illustrative work zones and crew routes use local offsets in metres. They are not surveyed geographic positions.</p><button className="primary" onClick={() => p.go("field")}>Open crew exercise map →</button></Panel><Panel title="Logistics layer"><p>Shipment ETA and status are registered records. The journey animation is an exercise and does not represent vessel GPS.</p><button className="small-button" onClick={() => p.go("logistics")}>Open shipment workspace →</button></Panel></div><ResearchEvidence station={p.d.station} /><Notice>Geographic station locations are documented. Operational routes, hazard zones and building layouts need site verification before use.</Notice></div>;
}
