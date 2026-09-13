import { canWrite, hasWrites } from "./permissions";
import { OfficialWeather, ConnectionStatus } from "./OfficialWeather";
import { Operations, StationQuestions } from "./Operations";
import { Science } from "./Science";
import { useNavigation, routeHref } from "./navigation";
import { Appearance, EquipmentIdentity } from "./Appearance";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Compass,
  Search,
  Minimize2,
  Maximize2,
  Signal,
  LayoutDashboard,
  Network,
  Zap,
  Package,
  CloudSnow,
  ClipboardList,
  FlaskConical,
  Database,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  LogIn,
  Menu,
  WifiOff,
  RefreshCw,
  Shield,
  ChevronRight,
  Radio,
  Clock,
  Check,
  X,
} from "lucide-react";
import type { Page, Asset, Snapshot, ScenarioInputs } from "./types";
import {
  snapshot,
  startSession,
  API,
  request,
  path,
  setBearer,
  bearer,
  mutate,
} from "./api";
import {
  Overview,
  Energy,
  Logistics,
  Maintenance,
  Environment,
  Scenarios,
  DataPage,
  type Props,
} from "./pages";
import { AssetIcon } from "./Twin";
import { Exercise } from "./Exercise";
import { SearchRecords } from "./SearchRecords";
import { StationTwin } from "./StationTwin";
import { Incident } from "./Incident";
import {
  Panel,
  Badge,
  Notice,
  Modal,
  Evidence,
  Trend,
  Empty,
} from "./components";
import { latest, affected, n, date } from "./model";
const pages: {
  id: Page;
  name: string;
  icon: typeof Compass;
  subtitle: string;
}[] = [
  {
    id: "overview",
    name: "Station overview",
    icon: LayoutDashboard,
    subtitle: "A clear view of station systems, resources and priorities.",
  },
  {
    id: "twin",
    name: "Digital twin",
    icon: Network,
    subtitle:
      "Understand connected assets and inspect potential failure paths.",
  },
  {
    id: "energy",
    name: "Energy & resources",
    icon: Zap,
    subtitle: "Follow power balance, fuel availability and estimated autonomy.",
  },
  {
    id: "logistics",
    name: "Logistics",
    icon: Package,
    subtitle: "Track station stock, technical spares and expected shipments.",
  },
  {
    id: "environment",
    name: "Environment",
    icon: CloudSnow,
    subtitle:
      "Explore historical records with clear source and quality labels.",
  },
  {
    id: "maintenance",
    name: "Alerts & maintenance",
    icon: ClipboardList,
    subtitle: "Turn evidence into assigned work, then document the outcome.",
  },
  {
    id: "scenarios",
    name: "What-if workspace",
    icon: FlaskConical,
    subtitle:
      "Test assumptions and understand consequences without changing operations.",
  },
  {
    id: "evidence",
    name: "Data & evidence",
    icon: Database,
    subtitle:
      "Trace every value to its origin, acquisition and transformations.",
  },
  {
    id: "operations",
    name: "People & operations",
    icon: ClipboardList,
    subtitle:
      "Connect duty periods, outdoor activities, contact sessions and handovers.",
  },
  {
    id: "research",
    name: "Scientific workspace",
    icon: FlaskConical,
    subtitle:
      "Inspect data quality, service continuity and explicit model assumptions.",
  },
];
export default function App() {
  const nav = useNavigation();
  const { page, setPage, station, setStation, workspace, setWorkspace } = nav;
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [moreControls, setMoreControls] = useState(false);
  const [accountRole, setRole] = useState("public"),
    [audience, setAudience] = useState(
      () => localStorage.getItem("polaris-audience") || "operator",
    ),
    [ask, setAsk] = useState(false),
    [planningTarget, setPlanningTarget] = useState(180),
    [exercise, setExercise] = useState(false),
    [search, setSearch] = useState(false),
    [presentation, setPresentation] = useState(false),
    [lowBandwidth, setLowBandwidth] = useState(
      () => localStorage.getItem("polaris-low-bandwidth") === "true",
    ),
    [scenarioPreset, setScenarioPreset] = useState<
      ScenarioInputs | undefined
    >(),
    [focus, setFocus] = useState(""),
    [evidence, setEvidence] = useState<string[] | null>(null),
    [login, setLogin] = useState(false),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [stream, setStream] = useState("polling");
  const qc = useQueryClient();
  // Tab-local demo permissions follow its workspace, including after a reload.
  // Connected permissions come only from the authenticated server response.
  const role =
    !API && workspace === "browser-demo" ? "demo_operator" : accountRole;
  const q = useQuery({
    queryKey: ["snapshot", workspace, station],
    queryFn: () => snapshot(workspace, station),
    refetchInterval: API ? (lowBandwidth ? 120000 : 20000) : false,
    refetchOnWindowFocus: !lowBandwidth,
    retry: 1,
    staleTime: API ? 10000 : Infinity,
  });
  const d = q.data;
  const asset =
    nav.detail?.kind === "assets"
      ? d?.assets.find(
          (a) => a.code === nav.detail?.id || a.id === nav.detail?.id,
        ) || null
      : null;
  const incident =
    nav.detail?.kind === "alerts"
      ? nav.detail.id
      : nav.detail?.kind === "work-orders"
        ? d?.work_orders.find((w) => w.id === nav.detail?.id)?.alert_id || null
        : null;
  const setAsset = (a: Asset | null) => {
    if (a) nav.openDetail("assets", a.code);
    else if (nav.detail?.kind === "assets") setPage("twin");
  };
  const setIncident = (id: string | null) => {
    if (id) nav.openDetail("alerts", id);
    else if (
      nav.detail?.kind === "alerts" ||
      nav.detail?.kind === "work-orders"
    )
      setPage("maintenance");
  };
  useEffect(() => {
    document.title = `${station === "maitri" ? "Maitri" : "Bharati"} · ${page} | POLARIS`;
  }, [station, page]);
  const current = pages.find((p) => p.id === page)!;
  const notify = (s: string) => setToast(s);
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["snapshot", workspace, station] });
  const write =
    online &&
    !q.isError &&
    (workspace === "browser-demo" ||
      workspace.startsWith("session-") ||
      (workspace === "operational" && hasWrites(role)));
  const go = (p: Page) => {
    setPage(p);
    setMenu(false);
  };
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 7000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (!API || !online || lowBandwidth) return;
    const ac = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let retry = 1000;
    async function connect() {
      try {
        const r = await fetch(API + path(workspace, station) + "/events", {
          headers: bearer ? { Authorization: "Bearer " + bearer } : {},
          signal: ac.signal,
        });
        if (!r.ok || !r.body) throw new Error("stream unavailable");
        setStream("connected");
        retry = 1000;
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        while (!ac.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          pending += decoder
            .decode(chunk.value, { stream: true })
            .replace(/\r\n/g, "\n");
          let boundary;
          while ((boundary = pending.indexOf("\n\n")) >= 0) {
            const event = pending.slice(0, boundary);
            pending = pending.slice(boundary + 2);
            if (event.startsWith("event: refresh"))
              qc.invalidateQueries({
                queryKey: ["snapshot", workspace, station],
              });
          }
        }
        setStream("polling");
      } catch {
        setStream("polling");
      }
      if (!ac.signal.aborted) {
        timer = setTimeout(connect, retry);
        retry = Math.min(retry * 2, 30000);
      }
    }
    connect();
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [workspace, station, online, lowBandwidth, role, qc]);
  useEffect(() => {
    setScenarioPreset(undefined);
    setFocus("");
    setEvidence(null);
  }, [workspace, station]);
  const props: Props | undefined = d
    ? {
        d,
        go,
        detail: nav.openDetail,
        scenario: (v) => {
          setScenarioPreset(v);
          go("scenarios");
        },
        select: setAsset,
        evidence: setEvidence,
        investigate: setIncident,
        write,
        refresh,
        notify,
        role,
        planningTarget,
        setPlanningTarget,
        focus,
        setFocus,
      }
    : undefined;
  useEffect(() => {
    localStorage.setItem("polaris-low-bandwidth", String(lowBandwidth));
  }, [lowBandwidth]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (e.key === "Escape") setPresentation(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  async function begin() {
    setBusy(true);
    try {
      const w = await startSession();
      setWorkspace(w);
      setRole("demo_operator");
      notify(
        API
          ? "Private demo session created. Changes persist on the server."
          : "Private demo started. Changes are saved only in this browser tab.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function inject(value: number) {
    if (!d || !asset) return;
    const m = latest(d, "coolant_temperature", asset.id);
    const src = d.sources.find((s) => s.origin === "simulation");
    if (!m || !src) return;
    setBusy(true);
    try {
      await mutate(workspace, station, "/measurements", {
        asset_id: asset.id,
        source_id: src.id,
        metric: "coolant_temperature",
        value,
        unit: "degC",
        observed_at: new Date(
          new Date(m.observed_at).getTime() + 3600000,
        ).toISOString(),
      });
      await refresh();
      notify("Simulated reading recorded. Rule evaluation applied.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={
        "app " +
        (presentation ? "presentation-mode " : "") +
        (lowBandwidth ? "low-bandwidth " : "") +
        (!online || q.isError ? "disconnected" : "")
      }
    >
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <aside className={"sidebar " + (menu ? "is-open" : "")}>
        <div className="brand">
          <div className="brand-mark">
            <Compass size={30} strokeWidth={1.3} />
          </div>
          <div>
            <strong>POLARIS</strong>
            <span>ANTARCTIC OPERATIONS</span>
          </div>
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-label">OPERATIONS CONSOLE</div>
        <nav aria-label="Main navigation">
          {pages.map((p) => (
            <a
              href={routeHref(p.id, station, workspace)}
              key={p.id}
              className={page === p.id ? "active" : ""}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault();
                  go(p.id);
                }
              }}
              aria-current={page === p.id ? "page" : undefined}
            >
              <p.icon size={19} />
              <span>{p.name}</span>
              {p.id === "maintenance" &&
                !!d?.alerts.filter((a) => !a.recovered).length && (
                  <b className="nav-count">
                    {d.alerts.filter((a) => !a.recovered).length}
                  </b>
                )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="prototype-mark">
            <Shield size={18} />
            <span>
              Independent SIH prototype<small>SIH26060 · 2026</small>
            </span>
          </div>
          <p>
            No government endorsement.
            <br />
            No live infrastructure control.
          </p>
          <a href="/docs/HANDOVER.md" target="_blank">
            Project handover <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="row start">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              <a
                href={routeHref("overview", station, workspace)}
                onClick={(e) => {
                  e.preventDefault();
                  go("overview");
                }}
              >
                {station === "maitri" ? "Maitri" : "Bharati"}
              </a>{" "}
              <ChevronRight size={14} /> <b>{current.name}</b>
              {nav.detail && (
                <>
                  <ChevronRight size={14} />
                  <span>{asset?.code || nav.detail.kind}</span>
                </>
              )}
            </span>
          </div>
          <div
            className={"topbar-controls" + (moreControls ? " expanded" : "")}
          >
            <div className="responsive-extra">
              <Appearance />
            </div>
            <button
              className="small-button responsive-extra"
              onClick={() => setConnectionOpen(true)}
            >
              Connection
            </button>
            <select
              className="responsive-extra"
              aria-label="Workspace perspective"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value);
                localStorage.setItem("polaris-audience", e.target.value);
                go(e.target.value === "scientist" ? "research" : "overview");
              }}
            >
              <option value="operator">Operator</option>
              <option value="scientist">Scientist</option>
            </select>
            <button
              className="small-button responsive-extra"
              onClick={() => setAsk(true)}
            >
              Ask station
            </button>
            <button
              className="header-search icon-button"
              aria-label="Search records"
              title="Search records (Ctrl+K)"
              onClick={() => setSearch(true)}
            >
              <Search size={17} />
            </button>
            <label className="station-select">
              <span className="sr-only">Selected station</span>
              <select
                aria-label="Selected station"
                value={station}
                onChange={(e) => {
                  setStation(e.target.value);
                }}
              >
                <option value="maitri">Maitri station</option>
                <option value="bharati">Bharati station</option>
              </select>
            </label>
            <label className="mode-select">
              <span className="sr-only">Workspace</span>
              <select
                aria-label="Workspace"
                value={workspace}
                onChange={(e) => {
                  setWorkspace(e.target.value);
                  setAsset(null);
                }}
              >
                <option value="demo">Demonstration</option>
                <option value="operational">Operational</option>
                {workspace !== "demo" && workspace !== "operational" && (
                  <option value={workspace}>Private demonstration</option>
                )}
              </select>
            </label>
            <button
              className="header-mode icon-button responsive-extra"
              aria-label="Low-bandwidth mode"
              aria-pressed={lowBandwidth}
              title={
                lowBandwidth
                  ? "Low bandwidth: 2-minute polling, no stream or motion"
                  : "Normal sync"
              }
              onClick={() => setLowBandwidth((v) => !v)}
            >
              <Signal size={17} />
              <span>{lowBandwidth ? "Low bandwidth" : "Normal sync"}</span>
            </button>
            <button
              className="icon-button responsive-extra"
              aria-label={
                presentation ? "Exit presentation" : "Presentation mode"
              }
              aria-pressed={presentation}
              onClick={() => setPresentation((v) => !v)}
            >
              {presentation ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button
              className="exercise-trigger responsive-extra"
              onClick={() => setExercise(true)}
              disabled={!d || !online || q.isError}
            >
              <FlaskConical size={15} />
              <span>Run demo exercise</span>
            </button>
            <button
              className="avatar"
              title={role === "public" ? "Sign in" : role}
              aria-label="Sign in"
              onClick={() => setLogin(true)}
            >
              {role === "public" ? (
                <LogIn size={17} />
              ) : role === "demo_operator" ? (
                "D"
              ) : (
                "A"
              )}
            </button>
            <button
              className="small-button toolbar-more"
              aria-expanded={moreControls}
              onClick={() => setMoreControls(!moreControls)}
            >
              {moreControls ? "Fewer tools" : "More tools"}
            </button>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className={page === "overview" ? "overview-shell" : ""}
        >
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="section-number">
                  {String(pages.indexOf(current) + 1).padStart(2, "0")}
                </span>{" "}
                ANTARCTIC STATION MANAGEMENT
              </div>
              <h1>
                {page === "overview"
                  ? `${station === "maitri" ? "Maitri" : "Bharati"} / Station overview`
                  : current.name}
              </h1>
              <p>{current.subtitle}</p>
            </div>
            <div className="connection">
              <span className={!online || q.isError ? "amber-text" : ""}>
                {!online ? (
                  <>
                    <WifiOff size={14} /> Disconnected · cached records
                  </>
                ) : API ? (
                  <>
                    <Radio size={14} />
                    {q.isError
                      ? "Connection failed"
                      : stream === "connected"
                        ? "API connected"
                        : lowBandwidth
                          ? "Polling every 2 min"
                          : "Polling every 20 s"}
                  </>
                ) : (
                  <>
                    <Clock size={14} /> Published snapshot
                  </>
                )}
              </span>
              <small>
                {API && q.dataUpdatedAt
                  ? "Last successful fetch " +
                    date(new Date(q.dataUpdatedAt).toISOString())
                  : "Historical data · not live"}
              </small>
            </div>
          </div>
          <div
            className={
              "workspace-banner " +
              (workspace === "operational" ? "operational" : "")
            }
          >
            <div>
              <FlaskConical size={18} />
              <strong>
                {workspace === "operational"
                  ? "Operational workspace"
                  : workspace === "browser-demo"
                    ? "Private browser demonstration"
                    : workspace.startsWith("session-")
                      ? "Private demonstration session"
                      : "Demonstration workspace"}
              </strong>
              <span>
                {workspace === "operational"
                  ? API
                    ? "Authenticated records only · missing data stays unavailable"
                    : "Backend not connected · operational data unavailable"
                  : workspace === "browser-demo"
                    ? "Changes saved in this tab · server not connected"
                    : workspace.startsWith("session-")
                      ? "Isolated records · saved on the backend"
                      : "Synthetic station telemetry · illustrative topology"}
              </span>
            </div>
            {workspace === "demo" && (
              <button
                className="small-button"
                onClick={begin}
                disabled={busy || !online}
              >
                {busy ? "Starting…" : "Start private demo"}{" "}
                <ArrowRight size={14} />
              </button>
            )}
            {workspace === "browser-demo" && (
              <Badge tone="muted">This tab only</Badge>
            )}
          </div>
          {workspace === "operational" && (
            <OfficialWeather station={station} role={role} operational />
          )}
          {workspace === "operational" && !API && (
            <Notice>
              No operational measurements are available in this deployment. The
              containerized backend must be connected before sign-in, ingestion
              and persistent team workflows can run.
            </Notice>
          )}
          {!online && (
            <Notice tone="amber">
              Last successful data is shown from memory. Writes are disabled; no
              offline write queue is implemented.
            </Notice>
          )}
          {lowBandwidth && (
            <Notice>
              Low-bandwidth mode: reads poll every two minutes when a server is
              connected. Streaming and animation are paused. Writes require a
              connection; no offline queue or binary deltas are claimed.
            </Notice>
          )}
          {q.isError && d && (
            <Notice tone="amber">
              Refresh failed. Cached records are retained; writes are disabled
              until the connection recovers.{" "}
              <button className="text-button" onClick={() => q.refetch()}>
                Retry now
              </button>
            </Notice>
          )}
          {nav.invalid ? (
            <Panel>
              <Empty title="Page not found">
                Choose a station workspace from the navigation.
              </Empty>
              <button className="primary" onClick={() => go("overview")}>
                Open station overview
              </button>
            </Panel>
          ) : q.isLoading ? (
            <div className="loading" role="status">
              <RefreshCw size={24} /> Loading workspace records…
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : q.isError && !d ? (
            <Panel>
              <Empty title="Workspace could not be loaded">
                {(q.error as Error).message}
              </Empty>
              <div className="actions centered">
                <button className="small-button" onClick={() => q.refetch()}>
                  Retry connection
                </button>
                {API && (
                  <a className="small-button" href="/?browser-demo=1">
                    Open browser demo
                  </a>
                )}
                {workspace === "operational" && (
                  <button
                    className="primary small"
                    onClick={() => setLogin(true)}
                  >
                    Sign in
                  </button>
                )}
              </div>
            </Panel>
          ) : (
            props && (
              <div key={workspace + station + page}>
                {page === "overview" ? (
                  <Overview {...props} />
                ) : page === "twin" ? (
                  <StationTwin {...props} />
                ) : page === "energy" ? (
                  <Energy {...props} />
                ) : page === "logistics" ? (
                  <Logistics
                    {...props}
                    write={write && canWrite(role, "logistics")}
                  />
                ) : page === "maintenance" ? (
                  <Maintenance
                    {...props}
                    write={write && canWrite(role, "maintenance")}
                  />
                ) : page === "environment" ? (
                  <Environment {...props} />
                ) : page === "operations" ? (
                  <Operations {...props} />
                ) : page === "research" ? (
                  <Science
                    {...props}
                    write={write && canWrite(role, "research")}
                  />
                ) : page === "scenarios" ? (
                  <Scenarios {...props} initial={scenarioPreset} />
                ) : (
                  <DataPage {...props} />
                )}
              </div>
            )
          )}
          <footer className="main-footer">
            <span>POLARIS / SIH26060</span>
            <span>
              Independent engineering prototype · Data origin always visible
            </span>
          </footer>
        </main>
      </div>
      {connectionOpen && (
        <Modal
          title="Operational readiness"
          onClose={() => setConnectionOpen(false)}
        >
          <ConnectionStatus />
          <OfficialWeather
            station={station}
            role={role}
            operational={workspace === "operational"}
          />
        </Modal>
      )}
      {ask && props && (
        <Modal title="Station questions" onClose={() => setAsk(false)}>
          <StationQuestions key={workspace + station} {...props} />
        </Modal>
      )}
      {exercise && d && (
        <Exercise
          d={d}
          onClose={() => setExercise(false)}
          notify={notify}
          onScenario={(v) => {
            setScenarioPreset(v);
            go("scenarios");
          }}
          onSession={(w, id, alert) => {
            setWorkspace(w);
            setRole("demo_operator");
            qc.invalidateQueries({ queryKey: ["snapshot", w, station] });
            setFocus(id);
            go("twin");
            if (w === workspace && alert) setIncident(alert);
          }}
        />
      )}
      {search && props && (
        <SearchRecords {...props} onClose={() => setSearch(false)} />
      )}
      {nav.detail?.kind === "shipments" && d && (
        <Modal title="Shipment record" onClose={() => go("logistics")}>
          <p>
            {d.shipments.find((s) => s.id === nav.detail?.id)?.name ||
              "Record unavailable in this workspace"}
          </p>
          {d.shipments
            .filter((s) => s.id === nav.detail?.id)
            .map((s) => (
              <div key={s.id}>
                <Badge>{s.status}</Badge>
                <p>Expected arrival {date(s.eta)}</p>
                <p>{s.risk}</p>
                {s.manifest.map((m, i) => (
                  <p key={i}>
                    {m.name} · {n(m.quantity)} {m.unit}
                  </p>
                ))}
                <h3>Status history</h3>
                {s.history.map((h, i) => (
                  <p key={i}>
                    {date(h.at)} · {h.status} · {h.note}
                  </p>
                ))}
              </div>
            ))}
        </Modal>
      )}
      {asset && d && (
        <Modal title={asset.name} onClose={() => setAsset(null)} wide>
          <div className="asset-detail-head">
            <AssetIcon kind={asset.kind} size={30} />
            <div>
              <span className="mono">{asset.code}</span>
              <p>{asset.kind} · Illustrative asset</p>
            </div>
            <Badge tone="muted">Topology unverified</Badge>
          </div>
          <EquipmentIdentity code={asset.code} />
          <div className="detail-columns">
            <div>
              <h3>Latest recorded measurements</h3>
              {[
                ...new Set(
                  d.measurements
                    .filter((m) => m.asset_id === asset.id)
                    .map((m) => m.metric),
                ),
              ].map((metric) => {
                const m = latest(d, metric, asset.id)!;
                return (
                  <button
                    className="measurement-row"
                    key={metric}
                    onClick={() => setEvidence([m.id])}
                  >
                    <div>
                      <strong>{metric.replaceAll("_", " ")}</strong>
                      <small>{date(m.observed_at)}</small>
                    </div>
                    <span>
                      {n(m.value)} {m.unit}
                      <ArrowUpRight size={14} />
                    </span>
                  </button>
                );
              })}
              {!d.measurements.some((m) => m.asset_id === asset.id) && (
                <p>No subsystem measurements registered.</p>
              )}
              <h3>Upstream supply</h3>
              <div className="dependency-chips">
                {affected(d, asset.id, true).map((a) => (
                  <button
                    className="chip"
                    key={a.id}
                    onClick={() => setAsset(a)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
              <h3>Potential downstream impact</h3>
              <div className="dependency-chips">
                {affected(d, asset.id).map((a) => (
                  <button
                    className="chip"
                    key={a.id}
                    onClick={() => setAsset(a)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
              <h3>Documentation</h3>
              {asset.documentation.map((doc) => (
                <p key={doc.url}>
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    {doc.title} ↗
                  </a>
                </p>
              ))}
              <h3>Maintenance history</h3>
              {d.work_orders
                .filter((w) => w.asset_id === asset.id)
                .map((w) => (
                  <p key={w.id}>
                    {w.title} · {w.status}
                    <br />
                    {w.resolution}
                  </p>
                ))}
              {!d.work_orders.some((w) => w.asset_id === asset.id) && (
                <p>No maintenance work recorded.</p>
              )}
            </div>
            <div>
              {asset.code === "GEN-A" ? (
                <>
                  <Trend
                    onEvidence={setEvidence}
                    thresholds={d.rules
                      .filter(
                        (r) =>
                          r.asset_id === asset.id &&
                          r.metric === "coolant_temperature",
                      )
                      .flatMap((r) => [
                        {
                          value: r.threshold,
                          label: "Trigger >",
                          tone: "amber",
                        },
                        {
                          value: r.recovery_threshold,
                          label: "Recovery ≤",
                          tone: "teal",
                        },
                      ])}
                    readings={d.measurements.filter(
                      (m) => m.asset_id === asset.id,
                    )}
                    metric="coolant_temperature"
                    title="Coolant temperature"
                    unit="°C"
                  />
                  {d.rules
                    .filter((r) => r.asset_id === asset.id)
                    .map((r) => (
                      <Notice key={r.id}>{r.assumption}</Notice>
                    ))}
                  {workspace !== "operational" && (
                    <>
                      <h3>Sensor exercise</h3>
                      <p>
                        Append a clearly simulated reading one hour after the
                        latest sample.
                      </p>
                      <div className="actions">
                        <button
                          className="small-button"
                          disabled={!write || busy}
                          onClick={() => inject(94)}
                        >
                          Simulate hot reading · 94 °C
                        </button>
                        <button
                          className="small-button"
                          disabled={!write || busy}
                          onClick={() => inject(82)}
                        >
                          Simulate recovery · 82 °C
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <Notice>
                  Missing measurements remain unavailable. Capacity{" "}
                  {asset.capacity == null
                    ? "is not registered"
                    : `is an assumed ${asset.capacity} ${asset.capacity_unit}`}
                  .
                </Notice>
              )}
            </div>
          </div>
        </Modal>
      )}
      {d &&
        nav.detail &&
        ["assets", "work-orders"].includes(nav.detail.kind) &&
        !(asset || incident) && (
          <Modal title="Record unavailable" onClose={() => go(page)}>
            <Notice>
              This record is absent from the selected station and workspace.
              Check the address or return to its register.
            </Notice>
          </Modal>
        )}
      {incident && props && (
        <Modal
          title="Incident investigation"
          onClose={() => setIncident(null)}
          wide
        >
          <Incident
            {...props}
            go={(page) => {
              setIncident(null);
              go(page);
            }}
            incidentId={incident}
          />
        </Modal>
      )}
      {evidence && d && (
        <Modal title="Evidence & lineage" onClose={() => setEvidence(null)}>
          <Evidence d={d} ids={evidence} />
        </Modal>
      )}
      {login && (
        <Modal title="Sign in to POLARIS" onClose={() => setLogin(false)}>
          {API ? (
            <>
              <p>
                Use an account created by your administrator. Access is checked
                by the backend.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setBusy(true);
                  try {
                    const r = await request(
                      "/auth/token",
                      new URLSearchParams({
                        username: String(f.get("username")),
                        password: String(f.get("password")),
                      }),
                    );
                    setBearer(r.access_token);
                    setRole(r.role);
                    setWorkspace("operational");
                    qc.clear();
                    setLogin(false);
                    notify("Signed in. Operational workspace selected.");
                  } catch (e) {
                    notify((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Username
                  <input name="username" autoComplete="username" required />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <Notice>
                The public demonstration has no connected authentication server.
                Team sign-in becomes available with the FastAPI deployment.
              </Notice>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  await begin();
                  setLogin(false);
                }}
              >
                Try a private browser demo
              </button>
            </>
          )}
          {role !== "public" && API && (
            <button
              className="text-button"
              onClick={() => {
                setBearer("");
                setRole("public");
                setWorkspace("demo");
                qc.clear();
                setLogin(false);
              }}
            >
              Sign out
            </button>
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
