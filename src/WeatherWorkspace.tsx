import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Panel, Badge, Notice } from "./components";
import { OfficialWeather } from "./OfficialWeather";
import type { Props } from "./pages";

const coordinates: Record<string, [number, number]> = {
  maitri: [-70.76444, 11.73417],
  bharati: [-69.40683, 76.19533],
};
type Forecast = {
  current: Record<string, number | string>;
  current_units: Record<string, string>;
  hourly: Record<string, Array<number | string | null>>;
  generationtime_ms: number;
};
const parameters = [
  ["temperature_2m", "Air temperature", "°C"],
  ["wind_speed_10m", "Wind speed", "m/s"],
  ["surface_pressure", "Surface pressure", "hPa"],
  ["relative_humidity_2m", "Relative humidity", "%"],
] as const;
export function useRegionalWeather(station: string) {
  const [lat, lon] = coordinates[station];
  return useQuery<Forecast>({
    queryKey: ["external-weather-model", station],
    queryFn: async () => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lon));
      url.searchParams.set("current", "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m");
      url.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m");
      url.searchParams.set("past_days", "2");
      url.searchParams.set("forecast_days", "1");
      url.searchParams.set("timezone", "UTC");
      url.searchParams.set("wind_speed_unit", "ms");
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw Error("Weather-model provider unavailable");
      const data = await response.json();
      if (!data.current?.time || !Array.isArray(data.hourly?.time)) throw Error("Incomplete weather-model response");
      return data;
    },
    staleTime: 15 * 60_000,
    refetchInterval: 30 * 60_000,
    retry: false,
  });
}
function WeatherModel({ station }: { station: string }) {
  const [metric, setMetric] = useState<(typeof parameters)[number][0]>("wind_speed_10m");
  const [hours, setHours] = useState(24);
  const [lat, lon] = coordinates[station];
  const q = useRegionalWeather(station);
  const observation = q.data?.current;
  const selected = parameters.find(([name]) => name === metric)!;
  const rows = q.data?.hourly.time.map((time, i) => ({ time: String(time).slice(5, 16), at: Date.parse(String(time) + "Z"), value: q.data?.hourly[metric]?.[i] }))
    .filter((item) => typeof item.value === "number" && item.at <= Date.now())
    .slice(-hours) || [];
  return <Panel title="Latest available regional weather model" sub="Open-Meteo forecast grid near the station · updated by provider · not a station sensor">
    {q.isPending ? <p role="status">Retrieving weather model…</p> : q.isError ? <Notice tone="amber">Weather-model values unavailable. {String(q.error)}. Archived government reports remain separately visible.</Notice> : <>
      <div className="weather-current" aria-label="Current model estimates">
        {parameters.map(([name, label, unit]) => <div key={name}><small>{label}</small><strong>{observation?.[name] ?? "—"} {unit}</strong></div>)}
        <div><small>Wind direction / gusts</small><strong>{observation?.wind_direction_10m ?? "—"}° / {observation?.wind_gusts_10m ?? "—"} m/s</strong></div>
      </div>
      <p><Badge tone="amber">Model estimate, not live station observation</Badge> Valid at {String(observation?.time)} UTC · retrieved {new Date(q.dataUpdatedAt).toLocaleString()} · grid {lat.toFixed(3)}°, {lon.toFixed(3)}°.</p>
      <div className="mission-toolbar"><label>Variable <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>{parameters.map(([name, label]) => <option key={name} value={name}>{label}</option>)}</select></label><label>Period <select value={hours} onChange={(e) => setHours(Number(e.target.value))}><option value="24">Last 24 hours</option><option value="48">Last 48 hours</option></select></label></div>
      <div className="weather-chart" role="img" aria-label={`${selected[1]} model time series for the last ${hours} hours`}><ResponsiveContainer width="100%" height="100%"><LineChart data={rows}><CartesianGrid strokeDasharray="3 6" stroke="var(--line)" /><XAxis dataKey="time" stroke="var(--muted)" minTickGap={45} /><YAxis stroke="var(--muted)" width={50} unit={selected[2]} /><Tooltip contentStyle={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--line)" }} /><Line type="monotone" dataKey="value" stroke="var(--ice)" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
      <p className="muted">Provider timestamps are UTC; the chart shows the last available modelled hours. Missing values remain gaps. <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Provider method and terms ↗</a></p>
    </>}
  </Panel>;
}
export function WeatherWorkspace(p: Props) {
  return <div className="mission-workspace"><p className="eyebrow">STATION / ENVIRONMENT / SOURCE</p>
    <WeatherModel station={p.d.station} />
    <OfficialWeather station={p.d.station} role={p.role} operational={p.d.workspace === "operational"} />
    <Panel title="Official station graphs" sub="NCPOR dataset catalogue · time series imported only after data access and provenance are verified"><p>NCPOR lists temperature, air pressure, relative humidity, wind speed and wind direction for Maitri and Bharati, with hourly, daily and monthly averages. Underlying readings have not been imported into this workspace.</p><a href="https://data.ncpor.res.in/graph" target="_blank" rel="noreferrer">Open NCPOR meteorological graphs ↗</a></Panel>
  </div>;
}
