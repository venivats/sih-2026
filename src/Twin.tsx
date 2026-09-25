import { useId } from "react";
import {
  Zap,
  Fuel,
  BatteryCharging,
  Wind,
  Droplets,
  Radio,
  Box,
  Thermometer,
  Network,
  ArrowRight,
} from "lucide-react";
import type { Snapshot, Asset } from "./types";
import { affected, latest, n, date } from "./model";
import { Badge, Empty } from "./components";
export const AssetIcon = ({
  kind,
  size = 22,
}: {
  kind: string;
  size?: number;
}) => {
  const Icon =
    (
      {
        fuel: Fuel,
        generator: Zap,
        distribution: Network,
        battery: BatteryCharging,
        heating: Wind,
        water: Droplets,
        communications: Radio,
        load: Box,
        environment: Thermometer,
      } as Record<string, typeof Zap>
    )[kind] || Box;
  return <Icon size={size} />;
};
export function Twin({
  d,
  onSelect,
  onEdge,
  selected,
  compact = false,
}: {
  d: Snapshot;
  onSelect: (a: Asset) => void;
  onEdge?: (id: string) => void;
  selected?: string;
  compact?: boolean;
}) {
  const marker = useId().replaceAll(":", "");
  if (!d.assets.length) return <Empty title="Topology not registered" />;
  const order = [
    "fuel",
    "generator",
    "battery",
    "distribution",
    "heating",
    "water",
    "communications",
    "load",
  ];
  const nodes = d.assets
    .filter((a) => a.kind !== "environment")
    .sort(
      (a, b) =>
        order.indexOf(a.kind) - order.indexOf(b.kind) ||
        a.code.localeCompare(b.code),
    );
  const impact = selected ? affected(d, selected).map((a) => a.id) : [];
  const column = (a: Asset) =>
    a.kind === "fuel"
      ? 0
      : ["generator", "battery"].includes(a.kind)
        ? 1
        : a.kind === "distribution"
          ? 2
          : 3;
  const groups = [0, 1, 2, 3].map((i) => nodes.filter((a) => column(a) === i));
  const height = Math.max(388, ...groups.map((g) => g.length * 96 + 4));
  const positions = Object.fromEntries(
    groups.flatMap((g, col) =>
      g.map((a, i) => [
        a.id,
        { x: 12 + col * 160, y: (height - g.length * 96) / 2 + i * 96 },
      ]),
    ),
  );
  return (
    <div className={"schematic " + (compact ? "compact-schematic" : "")}>
      <div className="twin-legend">
        <span>
          <i className="line-key" />
          Dependency
        </span>
        <span>
          <i className="line-key dashed" />
          Backup path
        </span>
        <span>
          <i className="selection-key" />
          Selected exposure
        </span>
      </div>
      <div
        className="schematic-scroll"
        tabIndex={0}
        role="region"
        aria-label="Interactive station systems schematic"
      >
        <div className="schematic-heading">
          <span>FUEL</span>
          <span>POWER & RESERVE</span>
          <span>DISTRIBUTION</span>
          <span>ESSENTIAL SYSTEMS</span>
        </div>
        <div className="schematic-canvas" style={{ height }}>
          <svg
            className="schematic-lines"
            viewBox={`0 0 628 ${height}`}
            aria-label="Stored dependency paths"
          >
            <defs>
              <marker
                id={marker}
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0 0L6 3L0 6" fill="none" stroke="context-stroke" />
              </marker>
            </defs>
            {d.edges.map((edge) => {
              const a = positions[edge.upstream],
                b = positions[edge.downstream];
              if (!a || !b) return null;
              const same = a.x === b.x;
              const sx = a.x + 124,
                sy = a.y + 43,
                tx = same ? b.x + 124 : b.x,
                ty = b.y + 43;
              const active =
                edge.upstream === selected || impact.includes(edge.upstream);
              return (
                <path
                  key={edge.id}
                  role={onEdge ? "button" : undefined}
                  tabIndex={onEdge ? 0 : undefined}
                  aria-label={`Inspect ${edge.relationship} path: ${d.assets.find((a) => a.id === edge.upstream)?.code} to ${d.assets.find((a) => a.id === edge.downstream)?.code}${edge.backup ? " (backup)" : ""}`}
                  onClick={() => onEdge?.(edge.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onEdge?.(edge.id);
                    }
                  }}
                  style={{
                    cursor: onEdge ? "pointer" : undefined,
                    pointerEvents: "stroke",
                  }}
                  className={
                    active
                      ? "flow-active"
                      : edge.backup
                        ? "flow-backup"
                        : "flow-primary"
                  }
                  d={`M${sx},${sy} C${sx + 28},${sy} ${same ? tx + 28 : tx - 28},${ty} ${tx},${ty}`}
                  fill="none"
                  stroke={
                    active ? "#a9ddf0" : edge.backup ? "#63817d" : "#4d6277"
                  }
                  strokeWidth={active ? 2.4 : 1.5}
                  strokeDasharray={edge.backup ? "5 5" : undefined}
                  markerEnd={`url(#${marker})`}
                />
              );
            })}
          </svg>
          {nodes.map((a) => {
            const warning = d.alerts.some(
              (x) => x.asset_id === a.id && !x.recovered,
            );
            const metric = warning
              ? d.rules.find((r) => r.asset_id === a.id)?.metric
              : a.kind === "generator"
                ? "generation"
                : a.kind === "battery"
                  ? "soc"
                  : "consumption";
            const reading = metric ? latest(d, metric, a.id) : undefined;
            return (
              <button
                key={a.id}
                className={
                  "system-node " +
                  (warning ? "warning " : "") +
                  (a.id === selected ? "selected " : "") +
                  (impact.includes(a.id) ? "exposed" : "")
                }
                style={{ left: positions[a.id].x, top: positions[a.id].y }}
                onClick={() => onSelect(a)}
                aria-pressed={a.id === selected}
              >
                <span className="node-code">
                  <AssetIcon kind={a.kind} size={17} />
                  <span>{a.code}</span>
                </span>
                <strong>{a.name}</strong>
                <span
                  className="node-state"
                  title={
                    reading
                      ? `${reading.origin} / ${reading.verification} · ${date(reading.observed_at)} · historical`
                      : undefined
                  }
                >
                  {reading
                    ? `${n(reading.value)} ${reading.unit === "degC" ? "°C" : reading.unit} · ${reading.origin}`
                    : warning
                      ? "Attention required"
                      : a.code === "GEN-B"
                        ? "Standby · assumed"
                        : a.capacity !== null
                          ? "Capacity assumed"
                          : "Status unverified"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="twin-footer">
        <Badge tone="muted">Engineering demonstration</Badge>
        <span>Not the actual station layout · topology unverified</span>
      </div>
      {selected && !compact && (
        <div className="impact-summary">
          Potential downstream exposure <ArrowRight size={14} />
          {affected(d, selected)
            .map((a) => a.name)
            .join(", ") || "No downstream relationships registered"}
        </div>
      )}
    </div>
  );
}
