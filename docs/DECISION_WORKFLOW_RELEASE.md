# Decision workflow release

POLARIS now opens with a station choice and a briefing that displays station condition, outstanding decisions, and the newest observation's origin, age, and retrieval time. This is a bounded prototype. The briefing cannot infer safety from missing telemetry.

The private guided walkthrough creates an isolated simulated generator incident. Its steps cover warning review, a separately confirmed review of registered relationships, work assignment, resolution notes, and a saved handover that contains the matching resolved work order. "Restart" creates a fresh private session; it does not erase or silently alter an existing session. The dependency review acknowledgement is local to the browser and is not an operational audit record.

Each incident links its triggering source, registered dependency relationships, fuel inputs, current work owner, resolution notes and saved matching handovers. Dependencies marked verified in the record should not be taken to prove a complete surveyed station system. Simulated equipment readings remain marked as simulated.

Station geography and the evidence workspace now link original NCPOR and PIB sources plus peer-reviewed papers. The Maitri study area map is reproduced from Botsa et al. (2021), Figure 1, CC BY 3.0; its location and routes are historical research context rather than a crew positioning system. The Bharati CO₂ paper reflects January–February 2016, and the Maitri black carbon paper December 2018–February 2019. Maitri-II is planned with projected completion in 2032 according to the 10 December 2025 Ministry of Earth Sciences answer. None supplies present-day operational telemetry.

Demo path: station entrance → Maitri → Explore a station incident → inspect triggered reading → acknowledge → inspect relationships and mark browser review → create work order and assign owner → start work → resolve with notes → generate and save handover → return to incident to inspect preserved record.

Verification: frontend build, source and guide-state checks, existing model and browser state tests. Live multi-user operation depends on the connected backend. Browser screenshots should be inspected after the release deploy because this workspace's Playwright browser binary was unavailable.
