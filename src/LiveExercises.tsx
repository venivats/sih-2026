import { useEffect, useState } from "react";
import { Panel, Badge, Notice } from "./components";
import type { Props } from "./pages";
import { useRegionalWeather } from "./WeatherWorkspace";

const fictionalCrew = [
  { name: "Crew C-01", task: "Station support", from: [130, 228], to: [215, 225], lag: 0 },
  { name: "Crew C-02", task: "External inspection", from: [150, 245], to: [510, 160], lag: 0.18 },
  { name: "Crew C-03", task: "Equipment visit", from: [150, 205], to: [650, 260], lag: 0.32 },
  { name: "Crew C-04", task: "Check-in overdue exercise", from: [140, 205], to: [405, 360], lag: 0.12 },
] as const;
export function CrewMotion({ p }: { p: Props }) {
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !navigator.onLine || matchMedia("(prefers-reduced-motion: reduce)").matches || localStorage.getItem("polaris-low-bandwidth") === "true") return;
    const id = setInterval(() => setSeconds((n) => (n + 1) % 61), 1000);
    return () => clearInterval(id);
  }, [playing]);
  const progress = seconds / 60;
  return <Panel title="Four-person crew movement exercise" sub="Fictional routes · positions are simulated in this browser, not received from devices"><div className="actions"><button className="small-button" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pause" : "Play"} simulation</button><button className="small-button" onClick={() => { setPlaying(false); setSeconds(0); }}>Reset</button><span role="status">Exercise time {seconds}s / 60s</span></div><svg className="crew-motion-map" viewBox="0 0 800 430" role="img" aria-label="Simulated movement of four fictional crew members from a station reference along illustrative work routes"><rect x="100" y="185" width="90" height="75" rx="14" fill="var(--ice)" opacity=".24"/><text x="100" y="170" fill="var(--text)">Station reference</text><circle cx="560" cy="224" r="105" fill="none" stroke="var(--amber)" strokeDasharray="8 8"/><text x="475" y="120" fill="var(--text)">Boundary review exercise</text>{fictionalCrew.map((c, i) => {
    const t = Math.max(0, Math.min(1, progress * 1.3 - c.lag));
    const x = c.from[0] + (c.to[0] - c.from[0]) * t;
    const y = c.from[1] + (c.to[1] - c.from[1]) * t;
    return <g key={c.name}><path d={`M ${c.from[0]} ${c.from[1]} L ${c.to[0]} ${c.to[1]}`} stroke="var(--muted)" strokeDasharray="5 7" fill="none"/><path d={`M ${c.from[0]} ${c.from[1]} L ${x} ${y}`} stroke="var(--ice)" strokeWidth="3" fill="none"/><circle cx={x} cy={y} r="15" fill={i === 3 && seconds > 42 ? "var(--amber)" : "var(--teal)"} stroke="var(--surface)" strokeWidth="3"/><text x={x + 20} y={y - 12} fill="var(--text)">{c.name}</text></g>;
  })}</svg><div className="crew-motion-list">{fictionalCrew.map((c, i) => <div key={c.name}><strong>{c.name}</strong><span>{c.task}</span><Badge tone={i === 3 && seconds > 42 ? "amber" : "teal"}>{i === 3 && seconds > 42 ? "Check-in review (simulated)" : "Exercise position"}</Badge></div>)}</div><Notice>Routes, zones and movement are illustrative. The saved field assignments and check-ins are listed below. Animation does not create incident records or establish a person's safety.</Notice><button className="text-button" onClick={() => p.go("operations")}>Open duty roster →</button></Panel>;
}

export function ShipmentJourney(p: Props) {
  const [progress, setProgress] = useState(0), [playing, setPlaying] = useState(false);
  const model = useRegionalWeather(p.d.station);
  useEffect(() => {
    if (!playing || matchMedia("(prefers-reduced-motion: reduce)").matches || localStorage.getItem("polaris-low-bandwidth") === "true") return;
    const id = setInterval(() => setProgress((n) => (n + 2) % 101), 1000);
    return () => clearInterval(id);
  }, [playing]);
  const ship = p.d.shipments[0];
  const current = model.data?.current;
  const fresh = current?.time && Math.abs(Date.now() - Date.parse(String(current.time) + "Z")) <= 90 * 60000;
  const wind = Number(current?.wind_speed_10m), gust = Number(current?.wind_gusts_10m);
  const assessable = fresh && Number.isFinite(wind) && Number.isFinite(gust);
  const review = assessable && (wind >= 20 || gust >= 25);
  return <Panel title="Shipment journey exercise" sub="Illustrative progress · registered shipment status and ETA shown separately"><div className="actions"><button className="small-button" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pause" : "Play"} route simulation</button><button className="small-button" onClick={() => { setPlaying(false); setProgress(0); }}>Reset</button></div><div className="shipment-route" role="img" aria-label={`Illustrative shipment journey ${progress} percent complete`}><div style={{ width: `${progress}%` }} /><span style={{ left: `${Math.min(94, Math.max(4, progress))}%` }}>◆</span></div><div className="row"><span>Planning reference</span><strong>{progress}% simulated</strong><span>Station approach</span></div><p><strong>{ship?.name || "No shipment registered"}</strong> · status: {ship?.status || "unavailable"} · expected {ship?.eta || "unavailable"}</p><p>Last reported vessel position: <strong>Unavailable</strong> · no authorised GPS feed connected. Weather along an actual route cannot be assessed without a reported position and route.</p><Notice tone={review ? "amber" : undefined}>{model.isPending ? "Checking the regional model…" : model.isError || !assessable ? "Regional weather unavailable, incomplete or stale; shipment weather impact cannot be assessed." : review ? `Review station-approach conditions: regional model wind ${wind} m/s, gusts ${gust} m/s at ${current?.time} UTC. Prototype review triggers: wind ≥20 m/s or gusts ≥25 m/s. This does not describe weather along the vessel's route.` : `Regional model near the station: wind ${wind} m/s, gusts ${gust} m/s at ${current?.time} UTC. No approach threshold exceeded; route conditions remain unknown.`} Any delay and fuel consequence require an operator-entered scenario; this animation does not change inventory or ETA.</Notice><div className="actions"><button className="small-button" onClick={() => p.go("weather")}>Review weather →</button><button className="small-button" onClick={() => p.go("scenarios")}>Compare delay and fuel →</button></div></Panel>;
}
