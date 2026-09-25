import { useState, useEffect } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
export function Appearance() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("polaris-theme") || "dark",
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    localStorage.setItem("polaris-theme", theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return (
    <label className="appearance-control">
      {theme === "dark" ? (
        <Moon size={16} />
      ) : theme === "light" ? (
        <Sun size={16} />
      ) : (
        <Monitor size={16} />
      )}
      <select
        aria-label="Colour theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
export function EquipmentIdentity({ code }: { code: string }) {
  const names: Record<string, string> = {
    "GEN-A": "Primary diesel generator set",
    "GEN-B": "Standby diesel generator set",
    FUEL: "Bulk diesel storage tank",
    BUS: "Main electrical distribution board",
    BAT: "Station battery bank",
    HVAC: "Heating and ventilation system",
    WATER: "Water treatment system",
    COMMS: "Communications terminal",
    LOAD: "Essential electrical loads",
    ENV: "Environmental monitoring instruments",
  };
  return (
    <div className="equipment-passport">
      <span className="eyebrow">EQUIPMENT IDENTITY</span>
      <strong>
        {names[code] || "Station equipment"} · {code}
      </strong>
      <p>
        Manufacturer / model: <b>Unverified</b>
      </p>
      <small>
        No station equipment specification has been supplied. Functional labels
        and capacities in the demo are illustrative.
      </small>
    </div>
  );
}
