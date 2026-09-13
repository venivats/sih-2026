import { GovernmentWeatherStrip, OfficialWeather } from "./OfficialWeather";
import { DecisionCentre, Handover } from "./Operations";
import { useState } from "react";
import {
  ArrowUpRight,
  Thermometer,
  Wind,
  ShieldCheck,
  Package,
  Network,
  ClipboardList,
  ScanLine,
} from "lucide-react";
import type { Props } from "./pages";
import { Badge, Panel, Trend } from "./components";
import { ServiceContinuity } from "./PlanningAnalysis";
import { OperationsMetrics } from "./OperationsMetrics";
import { StationTwin } from "./StationTwin";
import { Briefing, Readiness, ResourceHorizon } from "./Briefing";
import { latest, n, date } from "./model";

export function Overview(p: Props) {
  const { d, go, evidence } = p;
  const [view, setView] = useState("systems");
  const temp = latest(d, "temperature"),
    wind = latest(d, "wind_speed");
  const latestTime = [...d.measurements].sort((a, b) =>
    b.observed_at.localeCompare(a.observed_at),
  )[0]?.observed_at;
  const shipment = d.shipments[0];
  const tabs = [
    { id: "systems", name: "Systems view", icon: Network },
    { id: "brief", name: "Shift brief", icon: ClipboardList },
    { id: "readiness", name: "Data readiness", icon: ScanLine },
  ];
  return (
    <div className="operations-overview">
      <header className="station-hero antarctic-hero">
        <div className="station-identity">
          <div className="eyebrow">
            <span className="station-index">
              {d.station === "maitri" ? "01" : "02"}
            </span>{" "}
            ANTARCTIC RESEARCH / REMOTE OPERATIONS
          </div>
          <h1
            aria-label={`${d.station === "maitri" ? "Maitri" : "Bharati"} / Station overview`}
          >
            {d.station.toUpperCase()}
            <span className="station-period">.</span>
          </h1>
          <p>Infrastructure, resources and research continuity.</p>
          <a
            className="image-credit"
            href="https://science.nasa.gov/earth/earth-observatory/antarctic-landscape-illuminated-84683/"
            target="_blank"
            rel="noreferrer"
          >
            Landscape: coastal West Antarctica · NASA / Michael Studinger, 2014.
            Illustrative context, not this station.
          </a>
        </div>
        <div className="hero-conditions">
          <div className="conditions-title">
            RECORDED ENVIRONMENT <ArrowUpRight size={14} />
          </div>
          <div className="conditions-values">
            <button
              disabled={!temp}
              onClick={() => temp && evidence([temp.id])}
            >
              <Thermometer size={19} />
              <strong>
                {n(temp?.value)}
                <small> °C</small>
              </strong>
              <span>Air temperature</span>
            </button>
            <button
              disabled={!wind}
              onClick={() => wind && evidence([wind.id])}
            >
              <Wind size={19} />
              <strong>
                {n(wind?.value)}
                <small> m/s</small>
              </strong>
              <span>Wind speed</span>
            </button>
          </div>
          <small>
            {temp
              ? `${temp.origin} · ${date(temp.observed_at)}`
              : "No station observation available"}
          </small>
        </div>
      </header>
      <GovernmentWeatherStrip
        station={d.station}
        onInspect={() => setView("readiness")}
      />
      <div className="overview-switcher">
        <div role="tablist" aria-label="Station overview views">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={"tab-" + t.id}
              aria-controls={"view-" + t.id}
              aria-selected={view === t.id}
              tabIndex={view === t.id ? 0 : -1}
              onKeyDown={(event) => {
                const i = tabs.findIndex((x) => x.id === t.id);
                let nextIndex: number | undefined;
                if (event.key === "ArrowRight")
                  nextIndex = (i + 1) % tabs.length;
                if (event.key === "ArrowLeft")
                  nextIndex = (i + tabs.length - 1) % tabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = tabs.length - 1;
                if (nextIndex !== undefined) {
                  event.preventDefault();
                  setView(tabs[nextIndex].id);
                  document.getElementById("tab-" + tabs[nextIndex].id)?.focus();
                }
              }}
              onClick={() => setView(t.id)}
            >
              <t.icon size={17} />
              {t.name}
              {t.id === "brief" && <span className="new-label">NEW</span>}
            </button>
          ))}
        </div>
        <span className="view-revision">RECORDS → INSIGHT → ACTION</span>
      </div>
      <div
        role="tabpanel"
        id={"view-" + view}
        aria-labelledby={"tab-" + view}
        className="overview-view"
      >
        {view === "brief" ? (
          <>
            <Handover {...p} />
            <Briefing {...p} />
          </>
        ) : view === "readiness" ? (
          <>
            <OfficialWeather
              station={d.station}
              role={p.role}
              operational={d.workspace === "operational"}
            />
            <Readiness {...p} />
          </>
        ) : (
          <>
            <OperationsMetrics {...p} />
            <DecisionCentre {...p} />
            <StationTwin {...p} />
            <div className="overview-lower">
              <Panel
                title="Power, over time"
                sub="Recorded generation and station demand"
                action={
                  <button className="text-button" onClick={() => go("energy")}>
                    Energy workspace <ArrowUpRight size={14} />
                  </button>
                }
              >
                <Trend
                  readings={d.measurements}
                  metric="generation"
                  second="consumption"
                  title="Station power"
                  unit="kW"
                  onEvidence={evidence}
                />
              </Panel>
              <ResourceHorizon {...p} />
            </div>
            <ServiceContinuity {...p} />
            <div className="bottom-context">
              <Panel title="Resupply watch" action={<Package size={20} />}>
                {shipment ? (
                  <>
                    <div className="row">
                      <strong>{shipment.name}</strong>
                      <Badge tone="muted">{shipment.status}</Badge>
                    </div>
                    <p>
                      Expected {date(shipment.eta)} ·{" "}
                      {d.workspace === "operational"
                        ? "Registered record"
                        : "Simulated shipment"}
                    </p>
                    <p>{shipment.risk}</p>
                  </>
                ) : (
                  <p>No shipments registered.</p>
                )}
                <button className="text-button" onClick={() => go("logistics")}>
                  Manifest & inventory <ArrowUpRight size={14} />
                </button>
              </Panel>
              <Panel
                title="Evidence, not assumptions"
                action={<ShieldCheck size={20} />}
              >
                <p>
                  {d.measurements.length} measurements · {d.sources.length}{" "}
                  sources ·{" "}
                  {d.sources.length &&
                  d.sources.every((s) => s.origin === "simulation")
                    ? "simulation only"
                    : "inspect each source classification"}
                </p>
                <p>
                  Latest observation: {date(latestTime)}. Refreshing the page
                  does not make observations live.
                </p>
                <button className="text-button" onClick={() => go("evidence")}>
                  Source register <ArrowUpRight size={14} />
                </button>
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
