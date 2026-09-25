import { useRef, useState, type FormEvent } from "react";
import { PackageCheck, Plus, ArrowRight } from "lucide-react";
import type { Props } from "./pages";
import { Panel, Notice, Modal, Badge, Empty } from "./components";
import { date, n } from "./model";
import { mutate } from "./api";
import { randomId } from "./id";

export function Waste(p: Props) {
  const [add, setAdd] = useState(false),
    [category, setCategory] = useState("solid_waste"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [moving, setMoving] = useState("");
  const key = useRef(randomId());
  const names: Record<string, string> = {
    sewage_sludge: "Sewage sludge",
    solid_waste: "Compacted solid waste",
    incinerator_ash: "Incinerator ash",
    empty_fuel_drums: "Empty fuel drums",
  };
  const next: Record<string, string> = {
    collected: "packed",
    packed: "loaded",
    loaded: "returned",
  };
  const rows = p.d.waste || [],
    selected = rows.find((r) => r.id === moving);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      if (selected)
        await mutate(
          p.d.workspace,
          p.d.station,
          "/waste/" + selected.id,
          { status: next[selected.status], note: String(f.get("note")) },
          "PATCH",
        );
      else
        await mutate(p.d.workspace, p.d.station, "/waste", {
          category,
          quantity: Number(f.get("quantity")),
          unit: category === "empty_fuel_drums" ? "each" : "kg",
          location: String(f.get("location")),
          destination: String(f.get("destination")),
          shipment_id: f.get("shipment_id") || null,
          evidence: String(f.get("evidence")),
          idempotency_key: key.current,
        });
      await p.refresh();
      setAdd(false);
      setMoving("");
      key.current = randomId();
      p.notify("Waste custody record saved with audit history.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel
        title="Waste & retrograde register"
        sub="Track material, custody and return evidence"
        action={
          <button
            className="primary small"
            disabled={!p.write}
            onClick={() => {
              setAdd(true);
              setError("");
            }}
          >
            <Plus size={15} />
            Register waste
          </button>
        }
      >
        <Notice>
          Records support a waste-management review under{" "}
          <a
            href="https://www.ats.aq/e/waste.html"
            target="_blank"
            rel="noreferrer"
          >
            Environmental Protocol Annex III
          </a>
          . This prototype does not certify compliance or prescribe disposal
          methods. Entries require evidence; recorded return is not
          independently verified.
        </Notice>
        {!p.write && (
          <p className="muted small-copy">
            Start a private demo to practise the custody workflow, or sign in as
            an operator for operational records.
          </p>
        )}
        {!rows.length ? (
          <Empty title="No waste consignments registered">
            Register quantity, storage location, destination, and source
            evidence. No station waste totals have been assumed.
          </Empty>
        ) : (
          <div className="waste-register">
            {rows.map((r) => (
              <article key={r.id}>
                <div className="row">
                  <div className="row start">
                    <PackageCheck size={23} />
                    <h3>{names[r.category]}</h3>
                  </div>
                  <Badge tone={r.status === "returned" ? "teal" : "amber"}>
                    {r.status}
                  </Badge>
                </div>
                <div className="waste-quantity">
                  {n(r.quantity)} <span>{r.unit}</span>
                </div>
                <p>
                  {r.location} <ArrowRight size={13} /> {r.destination}
                </p>
                <p className="small-copy">
                  {r.origin} · authenticity unverified · {date(r.created_at)}
                </p>
                <p>{r.evidence}</p>
                <p className="small-copy">
                  Shipment:{" "}
                  {p.d.shipments.find((s) => s.id === r.shipment_id)?.name ||
                    "Not assigned"}
                </p>
                <details>
                  <summary>Custody & evidence history</summary>
                  <ol className="custody-history">
                    {r.history.map((h, i) => (
                      <li key={i}>
                        <strong>
                          {h.status} · {date(h.at)}
                        </strong>
                        <p>{h.note}</p>
                        <small>{h.actor}</small>
                      </li>
                    ))}
                  </ol>
                </details>
                {next[r.status] && (
                  <button
                    className="small-button"
                    disabled={!p.write}
                    onClick={() => {
                      setMoving(r.id);
                      setError("");
                    }}
                  >
                    Record {next[r.status]} <ArrowRight size={13} />
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
      {(add || selected) && (
        <Modal
          title={
            selected
              ? `Record ${next[selected.status]} custody`
              : "Register waste consignment"
          }
          onClose={() => !busy && (setAdd(false), setMoving(""))}
        >
          <form onSubmit={save}>
            {selected ? (
              <label>
                Evidence of custody change
                <textarea
                  name="note"
                  required
                  minLength={10}
                  maxLength={1000}
                  placeholder="Responsible person, packing or transfer reference, and verification limits"
                />
              </label>
            ) : (
              <>
                <label>
                  Waste category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {Object.entries(names).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity ({category === "empty_fuel_drums" ? "each" : "kg"})
                  <input
                    name="quantity"
                    type="number"
                    min={category === "empty_fuel_drums" ? 1 : 0.01}
                    max={1000000}
                    step={category === "empty_fuel_drums" ? 1 : 0.01}
                    required
                  />
                </label>
                <label>
                  Storage location
                  <input
                    name="location"
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </label>
                <label>
                  Return destination
                  <input
                    name="destination"
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </label>
                <label>
                  Linked shipment
                  <select name="shipment_id">
                    <option value="">Unassigned</option>
                    {p.d.shipments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source / collection evidence
                  <textarea
                    name="evidence"
                    required
                    minLength={10}
                    maxLength={2000}
                    placeholder="Collection record, responsible person, measurement method, and uncertainties"
                  />
                </label>
                <Notice>
                  {p.d.workspace === "operational"
                    ? "Manual entry · authenticity unverified"
                    : "Simulation · private demonstration only"}
                </Notice>
              </>
            )}
            {error && (
              <p role="alert" className="amber-text">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Saving…" : "Save custody record"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
