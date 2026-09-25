# Data-source register
Checked 7 September 2026. Dataset access and scientific authenticity are separate questions.

## NASA POWER: acquired
- Exact response title: **NASA/POWER Source Native Resolution Daily Data**. Provider: NASA POWER; response identifies MERRA2 and POWER, daily API v2.9.7.
- Dataset reference: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- Exact request and acquisition time: `public/evidence/acquisition-manifest.json`.
- Successful request: daily point API; latitude −70.764, longitude 11.734; UTC; 20240101–20240107; parameters T2M and WS10M; RE community; JSON. This coordinate is an approximate query location near Maitri, not surveyed metadata.
- Coverage: seven daily grid means, 1–7 January 2024; temperature at 2 m in °C, wind at 10 m in m/s. 14 values acquired and parsed successfully through the connector. No Bharati sample is claimed.
- Origin: reanalysis. Local processing: raw values retained with canonical unit names and UTC aggregation-day timestamps. These are already provider-processed grid estimates, not raw sensor observations. A timestamp denotes the daily aggregation period, not an instantaneous reading.
- Meteorological source grid: approximately 0.5° latitude × 0.625° longitude. Grid elevation and weather do not equal station conditions. https://power.larc.nasa.gov/docs/methodology/data/sources/
- Update frequency: underlying service updates as source data arrives; meteorology near-real-time latency approximately 2–3 days. This connector intentionally requests a fixed historical week and caches attempts for 24 hours; it is not a live feed.
- Access: no credentials required for this successful API retrieval; one bounded request per selected location; 20-second timeout; 2 MB response limit. Failed retrieval is recorded; it never generates substitute observations.
- Usage terms: the NASA-managed AWS Open Data registry states no restrictions on use/access/download, requests attribution, and links CC BY 4.0: https://registry.opendata.aws/nasa-power/ . The NASA data catalogue separately says “License not specified”: https://data.nasa.gov/dataset/prediction-of-worldwide-energy-resources-power . This discrepancy is retained instead of claiming a universally verified licence.
- Attribution: meteorological data obtained from NASA POWER at NASA Langley Research Center; underlying historical meteorology is MERRA-2.
- Original response: `public/evidence/nasa-power-maitri-20240101-20240107.json`. SHA-256 is in the manifest. Parser: `nasa-power-daily-v1`. The response was not reconstructed from web search snippets.

## NCPOR / NPDC: candidate station observations
- Dataset-specific page title: **Maitri: Live Data**. https://data.ncpor.res.in/maitri/live
- Coverage displayed: Maitri; page inspected showed 5 September 2026, temperature, humidity, pressure and wind, plus daily statistics.
- Units displayed: °C, %, mBar/hPa; wind is labelled knots in one section and m/s in another. The timezone and exact aggregation semantics were not established from this page.
- Access result: page content successfully inspected through research; no raw dataset file/API response acquired into POLARIS. Never use a page title containing “Live” to assert current observations.
- Update cadence: not verified. Usage: page says all rights reserved; an open-data licence was not established. Do not scrape/import ambiguous values as verified observations.
- Additional dataset-specific candidate: **Surface Data at Maitri & Gangotri — Synoptic Data**, https://npdc.ncpor.res.in/npdc/surfacedata_gangotri_maitri.jsp . Research retrieval timed out. Variables, period, API access and licence remain unverified.
- NPDC organisation homepage is only a discovery source, not evidence of dataset acquisition.

## British Antarctic Survey / SCAR READER: historical climate candidate
- Exact dataset: **Long-term dataset of mean surface and upper air meteorological measurements from a selection of Antarctic stations and automatic weather stations — READER project**.
- Dataset record: https://data.bas.ac.uk/full-record.php?id=GB%2FNERC%2FBAS%2FPDC%2F00248
- Station index: https://legacy.bas.ac.uk/met/READER/surface/
- Variables: principally monthly/annual means of temperature and pressure; coverage and completeness vary by station and parameter. Daily records are not provided by this product.
- Maitri and Bharati were not listed in the inspected surface index. Nearby Novolazarevskaya appears; it must not be relabelled as Maitri.
- Access: index/metadata inspected; no data file acquired. Dataset licence, station-specific periods and update cadence not verified for integration.

## IMD: documentary evidence, not an acquired feed
- Exact article: **A journey of 40-Year of polar meteorology**, MAUSAM, 2025.
- https://mausamjournal.imd.gov.in/index.php/MAUSAM/article/view/6473
- Article describes IMD Antarctic meteorological work at Dakshin Gangotri, Maitri and Bharati. It establishes an observation programme, not permission or availability of a machine-readable station feed.
- No raw IMD dataset acquired. Dataset-level variables, units, observation period, cadence, authentication and reuse terms remain unverified.

## Station metadata
Station names and programme context originate from the supplied SIH problem statement. POLARIS does not label precise station coordinates, surveyed layouts, equipment inventories, capacities or official procedures as verified. Schematic positions, assets and capacities are project-authored engineering examples. The NASA query coordinate is explicitly approximate.

## Internally generated demonstration
`backend/seed.py` generates fixed, repeatable 5–6 September 2026 examples and stores them only in `demo` or `session-*` workspaces. Origin=simulation; verification=illustrative; source provider=POLARIS project team. No NCPOR attribution appears on generated data. Project-authored synthetic data is offered under CC0-1.0.

## Geographic and visual context added 9 September 2026
These are context sources, not new station telemetry. Dataset acquisition does not establish the authenticity of unrelated measurements.

- **Maitri and Bharati station descriptions**, NCPOR: https://ncpor.res.in/antarcticas/display/376-maitri- and https://ncpor.res.in/antarcticas/display/377-bharati . Retrieval succeeded 9 September 2026. Used for documented station location and general context; no hardware model inventory or current communications availability inferred.
- **Antarctic Landscape Illuminated**, NASA Earth Observatory, photograph by Michael Studinger, coastal West Antarctica, 29 October 2014: https://science.nasa.gov/earth/earth-observatory/antarctic-landscape-illuminated-84683/ . Image downloaded successfully; NASA informational imagery terms and credit recorded in public/images/credits.json. Header crop is clearly illustrative geographic context.
- **An aerial view of the Indian Station Maitri, Antarctica on February 2, 2005**, Ministry of Science and Technology / PIB, via Wikimedia Commons. Exact page, image URL and GODL-India evidence are in public/images/credits.json. Download succeeded. Individual photographer unlisted; historical date stays visible. The official licence page was not retrieved; Commons explicitly supplies the licence metadata.
- **Natural Earth 1:110m Admin 0 – Countries**, version 5.1.1 archive and official project GeoJSON: Antarctica geometry downloaded successfully, 8 polygons / 661 coordinate pairs. Public-domain terms: https://www.naturalearthdata.com/about/terms-of-use/ . Exact download references and checksum in public/images/map-source.json. Retained geometry is projected for display, not used for navigation or station topology.
