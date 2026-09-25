import { useState } from "react";
import { FileSearch } from "lucide-react";
import { Evidence, Modal, Badge } from "./components";
import type { Snapshot } from "./types";
export function Explanation({
  d,
  title,
  formula,
  inputs,
  assumptions,
  ids,
}: {
  d: Snapshot;
  title: string;
  formula: string;
  inputs: { label: string; value: string }[];
  assumptions: string[];
  ids: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        <FileSearch size={16} /> Explain this result
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)} wide>
          <Badge>Calculated from selected records</Badge>
          <p className="calculation-formula">{formula}</p>
          <dl>
            {inputs.map((i) => (
              <div key={i.label}>
                <dt>{i.label}</dt>
                <dd>{i.value}</dd>
              </div>
            ))}
          </dl>
          <h3>Assumptions & limitations</h3>
          <ul>
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p>
            Snapshot retrieved {d.fetched_at || "at an unavailable time"}.
            Retrieval time does not change observation time.
          </p>
          <h3>Input records</h3>
          <Evidence d={d} ids={ids} />
        </Modal>
      )}
    </>
  );
}
