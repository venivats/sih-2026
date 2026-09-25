import { useRef, useState } from "react";
import {
  Thermometer,
  CloudSnow,
  Ship,
  ArrowRight,
  RotateCcw,
  FlaskConical,
} from "lucide-react";
import { Modal, Notice, Badge } from "./components";
import { snapshot, startSession, mutate, API } from "./api";
import { randomId } from "./id";
import { date, latest } from "./model";
import type { ScenarioInputs, Snapshot } from "./types";

export function Exercise({
  d,
  onClose,
  onSession,
  onScenario,
  notify,
}: {
  d: Snapshot;
  onClose: () => void;
  onSession: (w: string, assetId: string, alertId: string | null) => void;
  onScenario: (v: ScenarioInputs) => void;
  notify: (s: string) => void;
}) {
  const [preset, setPreset] = useState("overheat"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef(randomId());
  const options = [
    {
      id: "overheat",
      icon: Thermometer,
      title: "Primary generator overheat",
      value: "94 °C",
      copy: "Record synthetic coolant samples, evaluate the configured rule, then investigate the incident.",
    },
    {
      id: "storm",
      icon: CloudSnow,
      title: "Katabatic storm assumption",
      value: "−50 °C · 130 km/h",
      copy: "Explore an assumed 15% demand increase. Weather severity is a scenario label; no meteorological prediction.",
    },
    {
      id: "delay",
      icon: Ship,
      title: "Supply vessel delay",
      value: "+45 days",
      copy: "Extend the registered shipment horizon by 45 days and estimate the fuel consequence.",
    },
    {
      id: "recovery",
      icon: RotateCcw,
      title: "Test sensor recovery",
      value: "Below recovery threshold",
      copy: "Record a qualifying simulated reading. Existing work orders remain open until explicitly resolved.",
    },
  ];
  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (preset === "storm" || preset === "delay") {
        const baseline = latest(d, "fuel_burn");
        const eta = d.shipments.find((s) => s.status !== "arrived")?.eta;
        if (preset === "delay" && (!baseline || !eta))
          throw new Error(
            "A burn observation and registered shipment ETA are required.",
          );
        const horizon =
          baseline && eta
            ? Math.max(
                0,
                (Date.parse(eta) - Date.parse(baseline.observed_at)) / 86400000,
              )
            : 14;
        if (horizon + 45 > 365 && preset === "delay")
          throw new Error(
            "The selected arrival is outside the model's 365-day horizon.",
          );
        onScenario({
          failure: preset === "storm" ? "weather" : "none",
          demand_increase: 0,
          shed_kw: 0,
          delay_days:
            preset === "delay" ? Math.round((horizon + 45) * 10) / 10 : 14,
          backup_kw: 180,
        });
        notify(
          preset === "delay"
            ? `Arrival assumption: baseline ETA +45 days; horizon starts at ${date(baseline?.observed_at)}.`
            : "Storm scenario prepared. The demand multiplier is an explicit assumption.",
        );
        onClose();
        return;
      }
      const workspace =
        d.workspace.startsWith("session-") || d.workspace.startsWith("browser-")
          ? d.workspace
          : await startSession();
      await snapshot(workspace, d.station);
      const result = (await mutate(workspace, d.station, "/exercises", {
        preset,
        idempotency_key: key.current,
      })) as { asset_id: string; alert_id: string | null };
      onSession(workspace, result.asset_id, result.alert_id);
      notify(
        preset === "recovery"
          ? "Recovery reading saved. Work-order status has not changed."
          : "Historical simulation recorded and rule evaluated. Your incident is ready to review.",
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Run an incident exercise"
      onClose={() => !busy && onClose()}
      wide
    >
      <div className="exercise-intro">
        <FlaskConical size={25} />
        <div>
          <h3>Explore the failure. Explain the response.</h3>
          <p>
            Controlled training inputs, visible evidence, and an accountable
            next step.
          </p>
        </div>
        <Badge tone="amber">Simulation only</Badge>
      </div>
      <div className="exercise-options">
        {options.map((o) => (
          <button
            key={o.id}
            aria-pressed={preset === o.id}
            disabled={busy}
            onClick={() => {
              setPreset(o.id);
              key.current = randomId();
              setError("");
            }}
          >
            <o.icon size={24} />
            <strong>{o.title}</strong>
            <b>{o.value}</b>
            <p>{o.copy}</p>
          </button>
        ))}
      </div>
      <Notice>
        {preset === "overheat" || preset === "recovery"
          ? `Runs in your private ${API ? "server session" : "browser tab"}. Operational records and other visitors are unaffected. Historical sample time advances; this is not live telemetry.`
          : "Pure what-if calculation. Baseline measurements, inventory, alerts and work orders are unchanged."}
      </Notice>
      {error && (
        <p role="alert" className="amber-text">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="primary" onClick={run} disabled={busy}>
          {busy
            ? "Applying exercise…"
            : preset === "storm" || preset === "delay"
              ? "Open scenario comparison"
              : "Run private exercise"}
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
