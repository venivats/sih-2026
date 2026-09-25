# POLARIS station entry and field context preview

The root address now introduces the product and selects Maitri or Bharati. Existing station deep links continue directly to the selected workspace. The POLARIS image supplied by the team is treated as artwork; the government Maitri photograph is attributed, and the West Antarctic landscape used for the Bharati card is identified as illustrative.

The station context page displays documented station coordinates on an Antarctic geographic map. The field workspace displays four fictional personnel on simulated routes with Play, Pause and Reset, alongside the existing saved assignments and check-ins. Movement is calculated only in the browser; no real device is connected, and it cannot establish safety or raise a recorded incident by itself.

The weather page shows recent regional Open-Meteo **model output** with valid time and retrieval time, and a separate NCPOR archived temperature report. Pressure, humidity, wind and temperature charts use model output. NCPOR's graph catalogue is linked, but its underlying official time series has **not** been imported. A failed external request leaves an explicit unavailable state. Neither a model value nor an archived station report is a live station sensor reading.

The shipment animation is a planning illustration. Registered shipment status and ETA remain separate, vessel position is unavailable without an authorised feed, and the existing fuel-delay scenario requires a human-entered assumption. The app displays new saved incidents through an in-app badge and link, and the existing incident page still handles acknowledgement and work. Emails remain deferred.

The guide panel answers supported questions from selected workspace records and explains how to navigate. It is deterministic assistance with no configured language-model service. Sign-in retains backend checks and offers an account-free isolated demonstration. There is no email password recovery until email delivery is configured.

## Verification

Check the entrance and both stations, Back/Forward and direct links; weather on demo and operational pages including provider failure; movement controls and reduced motion; shipment and fuel scenario; incident badge after a newly saved event; sign-in error messages and role isolation. Existing model and backend tests, production build and browser smoke checks are release gates. A rollback uses the prior `main` commit or the preceding Vercel production deployment.
