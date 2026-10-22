# Phase 9 — Games Night Series and Solo Results

**Stackhouse Social v0.9.0** · All ten existing games remain available.

## New in Phase 9

- **Best-of-five-style private series, first to three match wins:** The server keeps a score between invited players across consensual rematches. Drawn matches count but do not award a win. The current champion is announced and both players can agree to start a new series with scores reset.
- **Per-series match history:** Up to 12 most recent results, with a compact scoreboard shown on each player's phone. The server exposes only public match results and never hands, stockpiles, tokens or confidential card data.
- **Resilient scorekeeping:** An awarded result is keyed to a server-generated match number, so duplicate network requests, reconnects and persistence snapshots cannot count a win twice. Legacy rooms without a scoreboard receive clean default scores.
- **Solo victory book:** On each device the browser records wins, losses and draws across all ten games. The home screen shows total wins and each table displays its personal best wins. Solo match IDs survive refreshes and prevent the same completed game from being counted twice. Solo history stays local to that device/browser.
- **Better Eight Shift bot:** Considers the follow-up suit distribution in its own hand instead of playing the first legal card. Prefers regular cards to wild eights whenever possible; makes no use of private opponent cards.
- **Up-to-date offline edition:** The deployment build now regenerates and serves `/PLAY-OFFLINE.html` from source. This standalone bot edition works without the Node server once saved to a device.

## Run and verify

`npm test` validates room privacy, session results, consent, reloading, idempotent moves, user interface, bot play, and all ten engines. `npm run build` generates `PLAY-OFFLINE.html` and `dist/`; `npm start` hosts the online version and the standalone file. Automated browser smoke testing is also recommended on mobile and desktop.

### Limits

Private tables still support **two people**. Public matchmaking, multi-room tournament brackets and account-based leaderboards are not implemented. Persistent live rooms on Render still require `ROOM_DATA_FILE` on durable storage; if unset, table scores are lost when the server restarts. Physical-device multiplayer testing remains outstanding.

## Verification

The Phase 9 automated suite passes 92 tests. Chromium browser navigation is blocked by the current execution environment, so mobile layout and two-device visual acceptance testing must still be completed on actual devices. The existing private-room API integration tests cover two independent authenticated clients and live event streaming.
