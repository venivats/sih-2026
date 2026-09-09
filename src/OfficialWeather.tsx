import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Server, RefreshCw, ShieldCheck } from "lucide-react";
import { API, request } from "./api";
import { Panel, Badge, Notice } from "./components";
import { date, n } from "./model";

const portal = "https://data.ncpor.res.in/";
type Report = {
  id: string;
  status: string;
  acquired_at: string;
  checksum: string | null;
  parser_version: string;
  detail: string;
  payload: {
    temperature_c?: number;
    published_time_label?: string;
    observed_at?: string | null;
    timezone_status?: string;
  };
};
type Feed = {
  status: string;
  terms_status: string;
  latest_attempt: Report | null;
  last_retrieved_report: Report | null;
};
export function OfficialWeather({
  station,
  role,
  operational = false,
}: {
  station: string;
  role: string;
  operational?: boolean;
}) {
  const qc = useQueryClient(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const feed = useQuery<Feed>({
    queryKey: ["official-weather", station, role],
    queryFn: () => request("/w/operational/" + station + "/official-weather"),
    enabled: !!API && operational,
    staleTime: 60000,
    retry: false,
  });
  const report = feed.data?.last_retrieved_report;
  return (
    <Panel
      title="Official station weather"
      sub="NCPOR published reports · separate from demonstration telemetry"
      action={
        <a
          className="small-button"
          href={portal}
          target="_blank"
          rel="noreferrer"
        >
          Official portal <ExternalLink size={14} />
        </a>
      }
    >
      <div className="official-weather-grid">
        <div>
          <span className="eyebrow">
            {station.toUpperCase()} · PUBLISHED TEMPERATURE
          </span>
          <strong className="big-number">
            {n(report?.payload.temperature_c)} <small>°C</small>
          </strong>
          <Badge tone="amber">
            {report ? "Source review required" : "Feed unavailable"}
          </Badge>
        </div>
        <div>
          <dl className="connection-facts">
            <dt>Provider time</dt>
            <dd>
              {report?.payload.published_time_label || "Unavailable"}{" "}
              {report?.payload.timezone_status === "unspecified"
                ? "· timezone unspecified"
                : ""}
            </dd>
            <dt>Last backend attempt</dt>
            <dd>{date(feed.data?.latest_attempt?.acquired_at)}</dd>
            <dt>Last retrieved page</dt>
            <dd>{date(report?.acquired_at)}</dd>
          </dl>
        </div>
      </div>
      {!API ? (
        <Notice>
          The official portal is identified, but this website has no connected
          server to retrieve its reports. Open the provider page to inspect its
          published temperatures.
        </Notice>
      ) : !operational ? (
        <Notice>
          Open the authenticated operational workspace to inspect
          official-source intake. Demonstration readings remain isolated.
        </Notice>
      ) : feed.isPending ? (
        <p role="status">Checking source intake…</p>
      ) : feed.isError ? (
        <Notice tone="amber">
          {(feed.error as Error).message}. Sign in with a team account and
          retry.
        </Notice>
      ) : (
        <p>
          {feed.data?.latest_attempt?.detail ||
            "No official-source retrieval has been requested on this server."}
        </p>
      )}
      {report && (
        <Notice tone="amber">
          This is a provider-published page value, not verified live telemetry.
          An acquisition time does not establish observation freshness. Missing
          timezone, measurement semantics and dataset-specific reuse terms must
          be resolved before these reports enter operational calculations.
        </Notice>
      )}
      <div className="actions">
        {!!API && operational && (
          <button className="small-button" onClick={() => feed.refetch()}>
            Check intake status
          </button>
        )}
        {!!API && operational && role === "administrator" && (
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await request(
                  "/w/operational/" + station + "/official-weather/refresh",
                  {},
                );
                await qc.invalidateQueries({ queryKey: ["official-weather"] });
                setMessage(
                  "Retrieval attempt recorded. Inspect the result and its provenance.",
                );
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw size={15} />{" "}
            {busy ? "Retrieving…" : "Retrieve official page"}
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      <details>
        <summary>Source and verification details</summary>
        <p>
          Source: NCPOR, “Weather at Indian Polar Stations”. Public page found
          on 9 September 2026. It displayed a provider timestamp without a
          timezone; update cadence is unconfirmed. Direct retrieval from the
          development environment returned HTTP 502.
        </p>
        <p>
          Server retrieval uses a fixed official URL, a 20-second timeout, a 2
          MB limit and a one-hour cooldown. Originals and SHA-256 checksums are
          preserved on successful download. No synthetic fallback is generated.
        </p>
        {report && (
          <p className="mono">
            Parser {report.parser_version} · SHA-256 {report.checksum}
          </p>
        )}
        <a href="/docs/OFFICIAL_DATA_AND_HOSTING.md" target="_blank">
          Access findings and connection guide ↗
        </a>
      </details>
    </Panel>
  );
}
export function ConnectionStatus() {
  const health = useQuery<{
    status: string;
    database: string;
    server_time: string;
  }>({
    queryKey: ["connection-health"],
    queryFn: () => request("/health"),
    enabled: !!API,
    retry: false,
    staleTime: 30000,
  });
  return (
    <Panel
      title="Operational connection"
      sub="Server and data readiness are checked separately"
    >
      <div className="connection-steps">
        <div>
          <Server size={22} />
          <strong>Application server</strong>
          <Badge tone={health.data ? "teal" : "amber"}>
            {!API
              ? "Not connected"
              : health.isPending
                ? "Checking"
                : health.isError
                  ? "Unreachable"
                  : "Responding"}
          </Badge>
          <p>
            {API
              ? (health.error as Error)?.message || "Selected API: " + API
              : "This publication currently serves the frontend only."}
          </p>
        </div>
        <div>
          <ShieldCheck size={22} />
          <strong>Persistent database</strong>
          <Badge
            tone={health.data?.database === "postgresql" ? "teal" : "amber"}
          >
            {health.data?.database === "postgresql"
              ? "PostgreSQL responding"
              : health.data?.database || "Not verified"}
          </Badge>
          <p>
            {health.data
              ? "Checked " + date(health.data.server_time)
              : "Requires a successful backend database check."}
          </p>
        </div>
      </div>
      <Notice>
        A responding database does not verify backups, durable source-file
        storage or station connectivity. These have separate deployment checks.
      </Notice>
      <div className="actions">
        {!!API && (
          <button className="small-button" onClick={() => health.refetch()}>
            Recheck connection
          </button>
        )}
        <a
          className="small-button"
          href="/docs/OFFICIAL_DATA_AND_HOSTING.md"
          target="_blank"
        >
          Backend activation guide <ExternalLink size={14} />
        </a>
      </div>
    </Panel>
  );
}
