# Administrator import guide
Use the connected backend. Public browser demonstrations cannot durably upload files or import team records.

1. Sign in as administrator and select Operational, then Maitri or Bharati.
2. In Data & evidence, register the asset first if it does not exist. Asset codes are uppercase letters, digits and hyphens, max 20 characters.
3. Prepare UTF-8 CSV with this exact header order:

```csv
station,asset_code,metric,value,unit,observed_at
maitri,ENV,temperature,,degC,2026-01-01T00:00:00Z
```

This row deliberately has no measurement. The blank value becomes null. It is a schema example, not an observation.

4. Enter dataset title, source evidence/usage-rights reference and declared origin. The system assigns verification=unverified regardless of the claim.
5. Upload at most 2 MB / 1000 data rows and preview. All row errors must be resolved. Mixed stations, unknown assets, malformed timezones, invalid units, nonfinite values, malformed rows and duplicates are rejected.
6. Inspect normalized UTC timestamps and sample rows. Commit once. Every row is imported in one database transaction; a concurrent conflict rolls back the whole commit. Repeating a completed batch commit returns the existing batch.
7. Inspect source evidence. Original bytes are retained under a content checksum and remain available to authorised users even if validation failed. Retention can leave an orphan object after a failed database transaction; prune only against database references using a separately reviewed cleanup procedure.

| Metric | Canonical unit |
|---|---|
| temperature, coolant_temperature | degC |
| generation, consumption | kW |
| wind_speed | m/s |
| fuel_burn | L/day |
| soc, humidity | % |
| pressure | hPa |

A timezone is mandatory. `2026-01-01T05:30:00+05:30` normalizes to `2026-01-01T00:00:00+00:00`. Normalization is logged. Duplicates are identified by workspace, station, asset, metric and normalized observation timestamp. Imported historical records do not retroactively trigger current alerts. Use the operator measurement endpoint for explicitly intended rule evaluation.

Allowed attachments: PDF, TXT, MD and CSV, max 2 MB, served as downloads. Treat documents as untrusted evidence. Malware scanning is not implemented; do not broaden accepted file types without reviewing that boundary.
