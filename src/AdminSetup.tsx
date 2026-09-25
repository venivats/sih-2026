import type { Props } from "./pages";
import { request, path } from "./api";
import { Panel } from "./components";
export function AdminSetup(p: Props) {
  const base = path(p.d.workspace, p.d.station);
  async function submit(
    e: React.FormEvent<HTMLFormElement>,
    endpoint: string,
    numbers: string[] = [],
  ) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values: Record<string, unknown> = Object.fromEntries(form.entries());
    for (const key of numbers) values[key] = Number(values[key]);
    if ("backup" in values) values.backup = values.backup === "true";
    try {
      await request(base + endpoint, values);
      p.refresh();
      p.notify("Administrator configuration saved with an audit record.");
    } catch (error) {
      p.notify((error as Error).message);
    }
  }
  const assets = p.d.assets.map((a) => (
    <option key={a.id} value={a.id}>
      {a.code} · {a.name}
    </option>
  ));
  return (
    <Panel
      title="Operational configuration"
      sub="Administrator changes are audited; new topology stays unverified"
    >
      <details>
        <summary>Add an alert rule</summary>
        <form
          className="import-form"
          onSubmit={(e) =>
            submit(e, "/rules", ["threshold", "recovery_threshold", "debounce"])
          }
        >
          <label>
            Asset
            <select name="asset_id" required>
              {assets}
            </select>
          </label>
          <label>
            Metric
            <select name="metric">
              <option>coolant_temperature</option>
              <option>temperature</option>
              <option>consumption</option>
              <option>wind_speed</option>
            </select>
          </label>
          <label>
            High threshold
            <input type="number" step="any" name="threshold" required />
          </label>
          <label>
            Recover at or below
            <input
              type="number"
              step="any"
              name="recovery_threshold"
              required
            />
          </label>
          <label>
            Consecutive high readings
            <input
              type="number"
              name="debounce"
              min="1"
              max="20"
              defaultValue="2"
              required
            />
          </label>
          <label>
            Assumptions and reference
            <input name="assumption" minLength={15} required />
          </label>
          <button className="small-button">Save rule</button>
        </form>
      </details>
      <details>
        <summary>Register an inventory item</summary>
        <form
          className="import-form"
          onSubmit={(e) => submit(e, "/inventory", ["reorder_point"])}
        >
          <label>
            Item name
            <input
              name="name"
              minLength={2}
              required
              placeholder="Use Polar diesel for the linked fuel item"
            />
          </label>
          <label>
            Category
            <select name="category">
              {["fuel", "spare", "provisions", "medical", "other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Storage location
            <input name="location" minLength={2} required />
          </label>
          <label>
            Unit
            <select name="unit">
              {["L", "each", "kg", "kits"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Reorder threshold
            <input
              type="number"
              step="any"
              name="reorder_point"
              min="0"
              required
            />
          </label>
          <label>
            Source evidence
            <input name="evidence" minLength={5} required />
          </label>
          <button className="small-button">Register empty item</button>
          <p>
            Record a receipt in Logistics to establish the opening quantity.
          </p>
        </form>
      </details>
      <details>
        <summary>Add an unverified dependency</summary>
        <form className="import-form" onSubmit={(e) => submit(e, "/edges")}>
          <label>
            Upstream
            <select name="upstream" required>
              {assets}
            </select>
          </label>
          <label>
            Downstream
            <select name="downstream" required>
              {assets}
            </select>
          </label>
          <label>
            Relationship
            <select name="relationship">
              {["electricity", "fuel", "heat", "water", "data"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Supply path
            <select name="backup">
              <option value="false">Primary</option>
              <option value="true">Backup · assumed</option>
            </select>
          </label>
          <button className="small-button">Save dependency</button>
        </form>
      </details>
    </Panel>
  );
}
