import { useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import type { Props } from "./pages";
import { Modal, Badge } from "./components";

export function SearchRecords(p: Props & { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const records = [
    ...p.d.assets.map((a) => ({
      id: a.id,
      label: `${a.code} · ${a.name}`,
      type: "Asset",
      run: () => {
        p.setFocus(a.id);
        p.go("twin");
      },
    })),
    ...p.d.alerts.map((a) => ({
      id: a.id,
      label: a.title,
      type: "Alert",
      run: () => p.investigate(a.id),
    })),
    ...p.d.work_orders.map((w) => ({
      id: w.id,
      label: `${w.title} · ${w.assignee}`,
      type: "Work order",
      run: () => p.investigate(w.alert_id),
    })),
    ...p.d.sources.map((s) => ({
      id: s.id,
      label: `${s.title} · ${s.provider}`,
      type: "Source",
      run: () => p.evidence([s.id]),
    })),
  ]
    .filter((r) =>
      (r.label + " " + r.type).toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 12);
  return (
    <Modal title="Search this station workspace" onClose={p.onClose}>
      <label className="search-field">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Search assets, incidents and sources"
          placeholder="Asset, incident, assignee or source…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="small-copy muted">
        {p.d.station.toUpperCase()} ·{" "}
        {p.d.workspace === "operational" ? "Operational" : "Demonstration"} ·
        current workspace only
      </p>
      <div className="search-results">
        {records.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              p.onClose();
              r.run();
            }}
          >
            <Badge tone="muted">{r.type}</Badge>
            <span>{r.label}</span>
            <ArrowUpRight size={14} />
          </button>
        ))}
        {!records.length && (
          <p>No matching records. Try a system code or source name.</p>
        )}
      </div>
    </Modal>
  );
}
