import type { Reading, Snapshot } from "./types";
import { Badge } from "./components";
import { date } from "./model";
import { originLabel, readingAge } from "./evidenceModel";

export function EvidenceLabel({ d, reading, inspect }: { d: Snapshot; reading?: Reading; inspect?: () => void }) {
  const source = d.sources.find(s => s.id === reading?.source_id);
  return <div className="reading-provenance">
    <Badge tone={reading?.origin === "simulation" ? "amber" : "muted"}>{originLabel(reading?.origin)}</Badge>
    <span>{readingAge(reading)}</span>
    <span>Observed: {date(reading?.observed_at)}</span>
    <span>Source: {source?.provider || "Unavailable"}</span>
    {inspect && reading && <button className="text-button" onClick={inspect}>Inspect evidence</button>}
  </div>;
}
