import { BookOpen, ExternalLink } from "lucide-react";
import { Badge, Panel } from "./components";

const sources = [
  { station: "maitri", title: "Maitri station description", publisher: "NCPOR", period: "Station description · page publication date unspecified", kind: "Official documentation", url: "https://ncpor.res.in/pages/display/376-maitri-", finding: "Describes the main building, fuel facilities, lake water pump house, heating and satellite communications.", use: "Supports station context and facility categories. It does not establish equipment capacities or exact service connections." },
  { station: "bharati", title: "Bharati station description", publisher: "NCPOR", period: "Station description · page publication date unspecified", kind: "Official documentation", url: "https://ncpor.res.in/antarcticas/display/377-bharati", finding: "Published station location and accommodation context for India's coastal research base.", use: "Supports geographic context. Current equipment inventory and operating conditions require station records." },
  { station: "maitri", title: "Maitri-II planning", publisher: "Ministry of Earth Sciences / PIB", period: "Published 10 December 2025 · projected completion 2032", kind: "Government announcement", url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2201536&lang=1&reg=3", finding: "Describes a planned replacement station, research facilities and the projected completion timeline.", use: "Future planning context only. Proposed facilities are not installed assets at the existing Maitri station." },
  { station: "maitri", title: "Existing Maitri infrastructure limitations", publisher: "Parliamentary committee summary / PIB", period: "Published 25 March 2026", kind: "Government report", url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2245319", finding: "Records concerns about ageing infrastructure and waste-management systems at Maitri.", use: "Explains the maintenance need. It does not validate this prototype's failure predictions." },
  { station: "maitri", title: "Black carbon aerosols at Maitri", publisher: "Botsa et al. · Environmental Science: Atmospheres", period: "Measurements: December 2018–February 2019 · published 2021", kind: "Historical research", url: "https://doi.org/10.1039/D1EA00024A", finding: "Reports black carbon measurements alongside meteorological observations during an Antarctic summer campaign.", use: "Supports environmental measurement context. No black carbon feed, current instrument installation or pollution threshold is inferred." },
  { station: "bharati", title: "Meteorology and atmospheric CO₂ at Bharati", publisher: "Pathakoti et al. · Polar Research", period: "Measurements: January–February 2016 · published 2018", kind: "Historical research", url: "https://doi.org/10.1080/17518369.2018.1442072", finding: "Examines atmospheric CO₂ variability alongside weather during a research campaign at Bharati.", use: "Supports scientific context and observation provenance. It is not a live CO₂ reading or a validated forecasting model." },
];

export function ResearchEvidence({ station }: { station: string }) {
  return <Panel title="Station research & documentation" sub="What each source supports, and where its evidence ends">
    <p>These references inform the station context. Operational measurements and simulated exercises have their own source records.</p>
    {station === "maitri" && <p>The historical Schirmacher Hills study map is available through the <a href="https://doi.org/10.1039/D1EA00024A" target="_blank" rel="noreferrer">original research publication</a>. Its routes and contours do not represent live crew locations or surveyed operational zones.</p>}
    <div className="research-source-list">
      {sources.filter(s => s.station === station).map(s => <article key={s.url}>
        <Badge>{s.kind}</Badge><h3><BookOpen size={17} /> {s.title}</h3>
        <p className="source-period">{s.publisher}<br />{s.period}</p>
        <p>{s.finding}</p><p><strong>Use in POLARIS:</strong> {s.use}</p>
        <a href={s.url} target="_blank" rel="noreferrer">Read original source <ExternalLink size={14} /></a>
      </article>)}
    </div>
  </Panel>;
}
