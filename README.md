# STACKHOUSE Social

A premium, private card-and-tile games-night collection. Play [online](https://stackhouse-m50w.onrender.com) using invite codes or use the standalone `PLAY-OFFLINE.html` against House Bots without a connection. No real-money wagering.

## Play

Choose from six game families: **Stack Run** (Classic/Malice), **Contract** (Phase/Club/Shanghai/Crown), **Number Ladder**, **Tile Royale**, **Low Glow**, or **Eight Shift**. All ten original rules variants remain available, with their original internal mode IDs so existing saves still load. Eight rule sets support 2–6 participants online. Number Ladder and Low Glow are 2-player games.

**Games Night Mix:** Host a 2–6 player private table, select the games and choose 3, 5, 7 or 9 rounds. A running points table records each winner and names a House Champion. The TV link is spectator-only and excludes hidden cards. For three or more players, choose only group-compatible games.

**Solo:** Choose 1–5 House Bots for supported group games. Each bot has an avatar and play-style preference. Expert sequencing opponents use bounded, visible-card lookahead to find plays that unblock their stockpile; Expert Eight Shift evaluates future playable cards using its own hand and face-up discards. Neither algorithm peeks at opponents' private card values or the draw pile. Difficulty and enjoyment still require human playtesting. Number Ladder and Low Glow remain one human versus one bot.

## Run the source

Requires Node.js 20+.

```bash
npm install
npm test
npm run build
npm start
```

Open `http://localhost:4173` or use the `PORT` environment variable. `npm run build:offline` rebuilds the portable offline game. Rebuilding `dist/` happens automatically: it is not committed to GitHub.

## Deploy and retain rooms

Deploy the repository as a Node Web Service on Render: build command `npm install && npm run build`; start command `npm start`. The existing free-tier Render service is **not configured for durable storage**, so a restart or redeploy may lose active tables. Players see a warning when rooms are memory-only.

For permanent storage, create a Render PostgreSQL database in the same region, copy its **internal** database URL, and add `DATABASE_URL` to the web service's environment variables. Do **not** commit that URL, publish a screenshot of it, or also set `ROOM_DATA_FILE`. Redeploy the service, then check `/health` reports durable storage. A PostgreSQL instance can create hosting costs; verify Render prices before provisioning. The app uses `src/server/postgres-storage.js` to save and reload sessions. On persistent restarts users can resume their saved seat; without persistent storage, no recovery guarantee exists.

## Real-device acceptance (not yet signed off)

On one iPhone (Safari) and one Android handset (Chrome): join the same room; verify turns, card visibility, sound, and reconnection after refresh. Test a 4–6 person table with separate handsets, rotate host pause/resume, open a TV spectator link, and confirm that the TV never displays private hands. Test mobile portrait reflow, 200% text zoom, a keyboard, reduced motion and VoiceOver/TalkBack. Test a simulated network outage; finally test a *planned* server restart **only after enabling durable storage**. Do not perform a destructive restart of a live games-night table.

## Project organisation

`server.js` starts the HTTP/SSE service; `src/server/rooms.js` authenticates seats, enforces revisions and persists room state; `src/server/game-modules.js` adapts the six game engines to a common interface; `src/server/projections.js` redacts private hands; `src/engine/` contains pure rules; `src/main.js` orchestrates the browser interface; `src/ui/` contains the family catalogue, instructions and mobile action bar; `src/engine/sequence-planner.js` and `src/engine/eight-planner.js` hold bounded bot strategies; `src/tv.js` is the TV spectator view. See [MODULE-GUIDE.md](MODULE-GUIDE.md) for adding a game and [CHANGELOG.md](CHANGELOG.md) for the preserved phase history.

**Phase 25 status:** Version 2.6.0 extracts three reusable client views and adds visible-information planning to two Expert bot families. Other bots still use the existing heuristics. Full per-game view separation, bot takeover of disconnected seats, physical-device acceptance and permanent hosting storage are *not* included in this phase.

**Boundaries:** The six-family launcher is a presentation change, not a destructive rewrite of ten game rule sets. Bot strength and real-phone comfort still need human playtesting. The offline edition uses local system fonts and makes no font-network requests.


### Phase 26: disconnected-player replacement (host only)
If a human opponent leaves during an active match, the host can open Table details → Host controls and select **Replace … with a bot**. The server requires at least two minutes since the seat last connected or made an authenticated request; an actively connected player cannot be replaced. Replacement preserves the game position and score, invalidates the absent player's old session and cannot be undone during that match. The host must confirm before proceeding. These restrictions are enforced server-side even if someone bypasses the browser buttons. A server restart begins a fresh two-minute grace period.

House Bots automatically agree to rematches when a human requests one, so an abandoned seat cannot hold up Games Night Mix.

**Important:** This does not restore persistent multiplayer rooms unless Postgres or another genuinely durable storage backend has been configured. Hosts should use this option only when the player has clearly left the match. The displaced player cannot reclaim the same seat during that match.


### Phase 27: stronger Expert bot planning
Number Ladder Expert now makes bounded forecasts of an estimated future draw and places cards with follow-up options in mind. Low Glow Expert evaluates the benefits of clearing columns, replacing high-penalty cards and uncovering hidden cards, treating every unrevealed value as unknown. Both strategies keep the existing game rules and are included in the offline build. Verify with `npm test` and `npm run build`. Database provisioning and real-phone acceptance remain outstanding.
