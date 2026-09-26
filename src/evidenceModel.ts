import type { Reading, Snapshot } from "./types";

export function originLabel(origin?: string) {
  if (!origin) return "Origin unavailable";
  if (origin === "simulation") return "Simulated";
  if (/reanalysis|historical/.test(origin)) return "Historical data";
  if (/forecast|model/.test(origin)) return "Model estimate";
  if (/observ/.test(origin)) return "Observation record";
  if (/calculat|derived/.test(origin)) return "Calculated";
  return origin.replaceAll("_", " ");
}

export function readingAge(reading?: Reading, now = Date.now()) {
  if (!reading) return "No reading available";
  const observed = Date.parse(reading.observed_at);
  if (!Number.isFinite(observed)) return "Observation time invalid";
  const age = now - observed;
  if (age < -60000) return "Future timestamp: review required";
  if (age < 3600000) return `${Math.max(0, Math.floor(age / 60000))} min old`;
  if (age < 86400000) return `${Math.floor(age / 3600000)} h old`;
  return `${Math.floor(age / 86400000)} days old`;
}

export const guideKey = (d: Pick<Snapshot, "workspace" | "station">) =>
  `polaris-guide-${d.workspace}-${d.station}`;

export function incidentHandovers(d: Snapshot, incidentId: string) {
  return (d.operations || []).filter((r) =>
    r.kind === "handover" &&
    r.data.snapshot?.inputs?.work_orders?.some(
      (w: { alert_id?: string; status?: string }) => w.alert_id === incidentId && w.status === "resolved",
    ),
  );
}
