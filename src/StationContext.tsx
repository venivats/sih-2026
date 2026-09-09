import { useEffect, useState } from "react";
import { Panel, Badge } from "./components";
const meta = {
  maitri: {
    lat: -70.76444,
    lon: 11.73417,
    place: "Schirmacher Oasis",
    ref: "https://ncpor.res.in/antarcticas/display/376-maitri-",
  },
  bharati: {
    lat: -69.40683,
    lon: 76.19533,
    place: "Larsemann Hills area",
    ref: "https://ncpor.res.in/antarcticas/display/377-bharati",
  },
};
function xy(lon: number, lat: number) {
  const r = (90 + lat) * 5.2,
    t = (lon * Math.PI) / 180;
  return [180 + r * Math.sin(t), 180 - r * Math.cos(t)];
}
export function StationContext({ station }: { station: string }) {
  const [geo, setGeo] = useState<number[][][][] | null>(null);
  useEffect(() => {
    fetch("/images/antarctica.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((g) =>
        setGeo(g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]),
      )
      .catch(() => setGeo(null));
  }, []);
  const m = meta[station as keyof typeof meta];
  return (
    <Panel
      title="The Antarctic context"
      sub="Geographic context is separate from illustrative station topology"
    >
      <div className="station-context">
        <svg
          viewBox="0 0 360 360"
          role="img"
          aria-label="South polar map locating Maitri and Bharati"
        >
          <circle cx="180" cy="180" r="165" fill="var(--raised)" />
          {[50, 100, 150].map((r) => (
            <circle
              key={r}
              cx="180"
              cy="180"
              r={r}
              fill="none"
              stroke="var(--line)"
            />
          ))}
          {[0, 45, 90, 135].map((a) => (
            <line
              key={a}
              x1="180"
              y1="15"
              x2="180"
              y2="345"
              transform={`rotate(${a} 180 180)`}
              stroke="var(--line)"
            />
          ))}
          {geo?.map((poly, i) => (
            <path
              key={i}
              d={poly
                .map(
                  (r) =>
                    r
                      .map(
                        ([lon, lat], j) =>
                          (j ? "L" : "M") + xy(lon, lat).join(","),
                      )
                      .join(" ") + "Z",
                )
                .join(" ")}
              fill="var(--panel)"
              stroke="var(--muted)"
              strokeWidth=".7"
            />
          ))}
          {Object.entries(meta).map(([key, v]) => {
            const [x, y] = xy(v.lon, v.lat);
            return (
              <g key={key}>
                <circle
                  cx={x}
                  cy={y}
                  r={station === key ? 6 : 4}
                  fill="var(--ice)"
                />
                <text x={x + 10} y={y} fill="var(--text)" fontSize="14">
                  {key === "maitri" ? "Maitri" : "Bharati"}
                </text>
              </g>
            );
          })}
          <circle cx="180" cy="180" r="3" fill="var(--muted)" />
          <text x="140" y="205" fill="var(--muted)" fontSize="12">
            South Pole
          </text>
        </svg>
        <div>
          <Badge>Documentary station metadata</Badge>
          <h3>
            {station.toUpperCase()} / {m.place}
          </h3>
          <p>
            {Math.abs(m.lat).toFixed(4)}° S · {m.lon.toFixed(4)}° E
          </p>
          <a href={m.ref} target="_blank" rel="noreferrer">
            NCPOR station description ↗
          </a>
          <p>
            Both stations are away from the geographic South Pole. Dedicated
            satellite channels are described by NCPOR; contact schedules in this
            prototype are operator-entered, not calculated orbital passes.
          </p>
          {station === "maitri" && (
            <figure>
              <img
                width="768"
                height="576"
                src="/images/maitri-aerial-2005.jpg"
                alt="Historical aerial photograph of Maitri station, 2 February 2005"
                loading="lazy"
              />
              <figcaption>
                Historical Maitri · 2 Feb 2005. Ministry of Science and
                Technology / PIB, Government of India.{" "}
                <a href="https://commons.wikimedia.org/wiki/File:An_aerial_view_of_the_Indian_Station_Maitri,_Antarctica_on_February_2,_2005.jpg">
                  Source & GODL-India licence
                </a>
                . No endorsement implied.
              </figcaption>
            </figure>
          )}
        </div>
      </div>
      <small>
        Polar azimuthal equidistant projection ·{" "}
        {geo
          ? "Natural Earth 1:110m coastline, public domain"
          : "Coastline unavailable; coordinate grid only"}{" "}
        · schematic geographic context, not navigation or survey.{" "}
        <a href="https://www.naturalearthdata.com/about/terms-of-use/">
          Map terms
        </a>{" "}
        · <a href="/images/credits.json">Image credits</a>
      </small>
    </Panel>
  );
}
