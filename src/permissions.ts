// Mirrors server roles for helpful UI only; backend authorization is authoritative.
const rights: Record<string, string[]> = {
  public: [],
  viewer: [],
  scientist: ["research", "handover"],
  maintenance_engineer: ["maintenance", "handover"],
  logistics_coordinator: ["logistics", "operations", "handover"],
  station_lead: [
    "maintenance",
    "logistics",
    "operations",
    "research",
    "handover",
  ],
  operator: [
    "maintenance",
    "logistics",
    "operations",
    "research",
    "handover",
    "telemetry",
  ],
  administrator: [
    "maintenance",
    "logistics",
    "operations",
    "research",
    "telemetry",
    "settings",
    "handover",
  ],
  demo_operator: [
    "maintenance",
    "logistics",
    "operations",
    "research",
    "telemetry",
    "handover",
  ],
};
export const canWrite = (role: string, area: string) =>
  !!rights[role]?.includes(area);
export const hasWrites = (role: string) => (rights[role]?.length || 0) > 0;
