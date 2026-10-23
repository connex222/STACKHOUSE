# STACKHOUSE SOCIAL

**Current source version: v2.4.0 (Phase 24).** A private, phone-first collection of ten original house-rule card and tile games with 16 avatars, solo opponents, and server-authoritative multiplayer.

[Play the live game](https://stackhouse-m50w.onrender.com) · [GitHub repository](https://github.com/connex222/STACKHOUSE)

> **Documentation policy:** This `README.md` is the project's **single Markdown document**. It combines the original project guide, Phases 9–18 and the release-validation checklist without deleting their historical substance. The overview immediately below describes the current project. Older phase notes are preserved as dated development records, **not** present-day release or hosting claims.

## At a glance

| Feature | Current scope |
| --- | --- |
| Games | Stack Run, Phase Quest, Malice Duel, Contract Club, Crown Circuit, Number Ladder, Shanghai Nights, Tile Royale, Low Glow, Eight Shift |
| Solo | All ten games with a House Bot; Easy / Standard / Expert difficulty selection |
| Private online tables for 2–6 players | Eight Shift, Stack Run, Malice Duel, Tile Royale, Phase Quest, Contract Club, Crown Circuit, Shanghai Nights |
| Two-player online only | Number Ladder and Low Glow |
| Games Night Mix tournament | Two players; first to three wins |
| Audio | Adjustable sampled game cues and separately controlled ambience; audio troubleshooting inside Audio Settings; Sonilo/Mirelo originals preserved |
| Hosting | Node.js on Render; server owns private game state and validates turns |

## Play and develop

- **Instant offline play:** Open `PLAY-OFFLINE.html` in a browser. This is a self-contained, **bot-only** edition; it does not host online multiplayer.
- **Online:** Use the [live game](https://stackhouse-m50w.onrender.com) or run the Node server locally, create a private table and share the room code or invite link. Each person uses their own browser.
- **Build requirements:** Node.js 20 or later, followed by `npm install` when setting up the repository.

```bash
npm install
npm test
npm run build
npm start
# Open http://localhost:4173
```

`npm run build:offline` regenerates `PLAY-OFFLINE.html` separately.

### Important release limitations

- **Permanent PostgreSQL storage is not configured on the current Render service.** Room state may be lost following a server restart or redeployment. `DATABASE_URL` can activate the optional implementation, subject to confirming storage and hosting costs.
- **Physical iPhone/Android multiplayer acceptance remains outstanding.** Emulated-browser and server-side tests do not replace real handset testing.
- Full accessibility conformance is **not certified**; screen-reader, native zoom and image/gradient colour-contrast testing remain necessary.
- All games use original, simplified house rules rather than claiming to reproduce any third-party branded game's official rules. No real-money gambling is included.

## Documentation contents

- [Phase 24 — Release acceptance and recovery](#phase-24)
- [Phase 23 — Games-night TV and host controls](#phase-23)
- [Phase 22 — House Bot and interface polish](#phase-22)

- [Release acceptance and testing](#release-validation)
- [Phase 18 — Professional sound design](#phase-18)
- [Phase 19 — Reliable playback and sound controls](#phase-19)
- [Phase 17 — Accessibility and release readiness](#phase-17)
- [Phase 16 — Rules and accessibility corrections](#phase-16)
- [Phase 15 — Release audit](#phase-15)
- [Phase 14 — Six-player contract tables](#phase-14)
- [Phase 13 — Group multiplayer and balancing](#phase-13)
- [Phase 12 — Network acceptance](#phase-12)
- [Phase 11 — Persistence-ready architecture](#phase-11)
- [Phase 10 — Games Night Mix](#phase-10)
- [Phase 9 — Games Night Series](#phase-9)
- [Original project guide and earlier phase notes](#legacy-guide)

---

## Full release history

These sections preserve the original phase notes. Any phase-specific counts, plans or claims of uncompleted work refer to **that phase at the time**, not necessarily the current v1.8.0 build. Use the overview above for the current supported feature scope.

<a id="phase-18"></a>

## Phase 18 — archived release notes

> *Historical release note, originally maintained as `README_PHASE18.md`.*

Stackhouse now has nine short, independent sample-based sound cues and a shared player in `src/audio.js`. The game honours the sound toggle, caps playback gain, rate-limits frequently triggered cues, and falls back to the previous gentle procedural audio on browser decode/playback failure. Ambience remains a separate opt-in toggle.

### Providers and provenance

- **Mirelo** produced new close-miked card contact, tile contact and victory sounds (generation IDs `8b79d85418fdc31fea3a12ca2740b2bb`, `f54aadde62d46f2a67dc583c10cf4c27`, `75716b8e8894d6c83e11235a3f671c5d`).
- **Sonilo** produced an eight-second luxury tabletop Foley collection and an eight-second UI/reward effects collection (task IDs `7a692efa-d14e-42a8-9d3f-191b105d29ef`, `c5fc7d62-e5a2-4412-aec4-89f2a702e15e`).
- These provider links could not be downloaded inside the original coding container. The dedicated GitHub Actions import workflow fetches all five completed master files into `assets/audio/masters`, validates them, converts the three Mirelo sounds into playable cues and commits them back to the repository. This must succeed before describing the provider audio as integrated into the live game.
- Locally generated non-provider audio is bundled now as a portable fallback for the nine cue slots, so the app works even if the import workflow cannot fetch a recording.
- Sonilo's longer masters are preserved for editorial audition rather than blindly splitting arbitrary timestamps into individual effects.

### To verify

1. Confirm the **Import Sonilo and Mirelo produced audio** action succeeds after the Phase 18 commit.
2. Check `assets/audio/masters` contains five files, and compare each rendered cue at normal volume on physical devices.
3. Use the header speaker switch to opt into cues; verify mute stops audio and ambience can be toggled independently.
4. Confirm autoplay is blocked until the player interacts and no event can flood the sound engine.
5. Check the portable `PLAY-OFFLINE.html` includes sounds and runs without networking.

---

<a id="phase-17"></a>

## Phase 17 — archived release notes

> *Historical release note, originally maintained as `README_PHASE17.md`.*

Release scope: 22 October 2026. This phase maintains the feature freeze and does not change any game mechanics, opponents or card inventory.

### Improvements

- **Skip-navigation link:** The first keyboard focus stop, when tabbing into the application, is “Skip to main content”. Enter focuses the active main region. The link becomes clearly visible when focused, and is included in online and offline versions.
- **Single stable main landmark:** Home, room and all game views provide the same target (`#main-content`) with `tabindex="-1"`. This remains usable across the app's rendering system.
- **Expanded browser checks:** Automated Chromium coverage now exercises all ten bot games at 320px and 390px CSS viewports with WCAG text-spacing overrides (line height, letter spacing, word spacing and paragraph spacing). Tests reject document-level horizontal scrolling, obvious clipped controls and uncaught JavaScript exceptions.
- **CI:** The `Accessibility keyboard smoke` workflow runs the previous focus/dialogue tests and the new reflow suite on commits and pull requests.

### Verification

```sh
npm test
npm run build
python scripts/accessibility-smoke.py
python scripts/reflow-smoke.py
```

**Scope and limitations:** The two viewport widths approximate reflow at 400% from a 1280px display; this is **not a true native browser zoom test**. The script does not determine colour contrast accurately for the image-backed/gradient interface and does not reproduce screen-reader speech. A final accessibility conformance decision requires contrast sampling across states, native zoom, NVDA/VoiceOver/TalkBack testing, and actual device testing. No WCAG 2.2 AA conformance claim is made.

**Unchanged release conditions:** Eight games support 2–6 private online players, while Number Ladder and Low Glow remain two-player. Real physical-phone acceptance is incomplete. The Render service has no configured persistent PostgreSQL database; active rooms can be lost after a restart. No paid services have been provisioned by this phase.

---

<a id="phase-16"></a>

## Phase 16 — archived release notes

> *Historical release note, originally maintained as `README_PHASE16.md`.*

Release date: 22 October 2026. This is a focused follow-up to the independent rules and accessibility review.

### Rules: depleted-deck sequencing

**Confirmed issue:** Malice Duel could reach a turn with no cards in hand, no available draw cards and no legal stock or personal-discard plays. Six-player seeded games could not advance.

**Implemented house-rule resolution** (Stack Run and Malice Duel):
1. If your hand is empty but completed building stacks have supplied a recyclable draw deck, choose **Refill empty hand**. This does not end your turn.
2. If the hand, draw and recyclable piles are all empty and you have no legal stockpile/discard play, choose **Pass — no legal moves**. The server verifies every condition; players cannot voluntarily skip a playable turn.
3. If each player is forced to pass consecutively without any intervening card play or discard, the game ends in an **exhausted-deck showdown**. Fewest cards remaining in the personal stockpile wins; ties for the fewest cards are draws.
4. Any valid card play or hand discard resets the pass counter. This is a deterministic original house rule, not a claim about commercial Skip-Bo or Spite & Malice rules.

This also works for room sessions, private opponents, saved server games, solo bots and match-series draw accounting. A six-player, 250-seed computer simulation found every match resolved (victory or draw), preserving all original cards. This sample cannot prove that every possible player strategy terminates.

### Keyboard and accessibility

- Avatar and rules dialogues send focus inside when opened, trap Tab/Shift+Tab inside, make the page behind inert, close with Escape, and return focus to the exact triggering button.
- The UI keeps focused cards/tiles/controls across rerenders by stable card identity and button attributes, including in the tap-to-select card flow.
- The app-wide `aria-live` attribute was replaced by a small, persistent `role=status` announcement element. Status text changes only when the announcement changes; the full page is not read on every rerender.
- Sequencing and contract card buttons have `aria-pressed` when selected; individual sequencing discard cards and selected eights do too. Tile selection already exposed this state.
- Introductory tiles disclose immediate contract-round endings, Shanghai's lack of discard buying and Tile Royale's lack of full table rearrangement. Contract penalty points are explicitly informational, not a match-winning tie-break.
- Further narrow-screen CSS rules reduce the chance of horizontal clipping; the current synthetic 320/390px Chromium check shows no document-level horizontal overflow.

### Verification and limits

Commands:

```bash
npm test
npm run build
python scripts/accessibility-smoke.py
```

The new test module verifies forced passes, server-authoritative legality, refill constraints, ties, resetting passes, isolated private hands and seeded group-match completion. The optional Playwright smoke script checks focus, inert modal background, keyboard cycling, Escape return, retained card focus, `aria-pressed` and 320/390px layout; a GitHub Actions workflow runs it on main and pull requests.

**Unverified:** Native 400% browser zoom, screen-reader output (NVDA, VoiceOver, TalkBack), image-backed contrast, real physical phones, and actual cross-browser keyboard/drag behaviour. No claim of WCAG 2.2 AA conformance is made. Render PostgreSQL storage remains unconfigured, and cloud restarts can still lose active rooms. The live release has not been accepted by a physical games-night test group.

---

<a id="phase-15"></a>

## Phase 15 — archived release notes

> *Historical release note, originally maintained as `README_PHASE15.md`.*

Version **1.5.0** — 22 October 2026

### Release scope

This is a hardening and usability release, **not** a new game, ruleset or player-count expansion. The ten game modes, original artwork, 16 avatars, optional sounds, solo bots and private room formats are preserved.

- **Request safety:** HTTP JSON body limit now measures **bytes** (8 KiB), even for multibyte characters. `null` and array room/join payloads produce clear 400 responses instead of exposing internal errors.
- **Live event streams:** No more than three simultaneous SSE connections per authenticated player seat. Additional attempts receive HTTP 429 without affecting other seats; reconnecting after a disconnection is permitted.
- **Security headers:** API, live streams and static pages include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and a restricted `Permissions-Policy`. The existing Content Security Policy remains in place on game pages. Health endpoint accepts GET/HEAD only.
- **Mobile and accessibility:** Minimum 44-pixel controls for key lobby, sorting and room actions, stronger keyboard-focus outlines, narrow-viewport group seat layout and reduced-motion-friendly scroll/hover effects.
- **New automated audit tests:** UTF-8 oversized input, invalid payloads, protection of server-side modules, security headers, event-stream capacity and cleanup.

### Verified checks

Use `npm test` for all deterministic engines, multiplayer rooms, network HTTP/SSE tests, reconnection, saved-room simulations and release security tests. Use `npm run build` for the production static and self-contained offline packages. The `/health` endpoint explicitly reports `durableStorage:false` without a connected PostgreSQL database.

The project contains a browser interaction script at `scripts/browser-acceptance.py`, but it requires an environment permitting Chromium access to the local game server. Do not treat this as a passed browser/device test without successful execution.

### Outstanding launch blockers

1. **Real-device acceptance:** Verify Android and iPhone join, play, leave/rejoin, host-start, six-seat layout and end-of-match rematch with independent physical devices. Full multi-browser and screen-reader acceptance are also unverified.
2. **Permanent multiplayer storage:** The current Render instance is **memory-only**. PostgreSQL support exists but no database is connected, so rooms and tournament scores can disappear on server restart. Enabling storage may incur charges.
3. **Independent game-rules review:** The ten games are original simplified house-rule variants; an editorial/playtesting review of all rules and game balance is still advisable before a wider launch.

**Current scope:** 8 of 10 games support private 2–6-player tables. Number Ladder and Low Glow remain two-player. Games Night Mix remains two-player. Do not describe every game or the mixed tournament as supporting six players.

**Deployment:** Render is linked to the GitHub `main` branch with auto-deploy. Confirm the actual commit SHA, CI run and Render `live` status for this release rather than inferring success from a successful local build.

---

<a id="release-validation"></a>

## Release acceptance and validation

> *Historical release note, originally maintained as `README_RELEASE_VALIDATION.md`.*

**Scope:** Verification-only. No new game modes, changed house rules, or new hosting charges.

### What is now automated

- `npm test`: includes eight separate six-player private tables, seat-isolated card projections, full tables rejecting a seventh player, mutually-exclusive simultaneous revisions, duplicate move acknowledgements, six-player state restoration using a temporary snapshot file, and two-player-only mode restrictions.
- `npm run build`: produces a release and standalone offline build.
- GitHub Actions: the existing Node suite plus an **emulated mobile browser** job using independent Chromium contexts at 375, 390 and 412 px, checking head-to-head joins, opponent live updates, refresh recovery, a four-player contract table, horizontal overflow, and JavaScript errors.
- `STACKHOUSE_URL=http://127.0.0.1:4173 python scripts/browser-acceptance.py`: runs the same browser checks on a machine with Playwright Chromium installed and a locally running server.

### Release gates not waived

- These automated mobile contexts **are not physical phones**. Real iPhone/Android, mobile Safari and mobile Chrome sessions must still be tested. A practical manual test is: host a four- or six-seat room, join from distinct handsets, play legal moves, switch networks on one phone, rejoin, and agree a rematch.
- The production Render service is currently **memory-only**, with no PostgreSQL instance connected. File-backed local tests do not prove durability across a Render restart. Enabling a database could incur a charge and requires a separate decision.
- Obtain an independent review of the simplified house rules and a screen-reader/accessibility pass before claiming a full public launch.
- The browser job is an additional release check and must itself be confirmed green in GitHub Actions. If the CI image cannot run Chromium, that is an unverified check, not a pass.

---

<a id="phase-14"></a>

## Phase 14 — archived release notes

> *Historical release note, originally maintained as `README_PHASE14.md`.*

Version **1.4.0** — 22 October 2026

### Eight private group games (3–6 seats)

**New group modes:** Phase Quest, Contract Club, Crown Circuit and Shanghai Nights. They join the four previously implemented group modes: Eight Shift, Stack Run, Malice Duel and Tile Royale.

**Two-player only:** Number Ladder and Low Glow, whose game engines require separate multiplayer adaptations. Games Night Mix still runs with two players. The House Bot modes, original assets and 16 avatars remain available.

The host chooses an eligible game and three to six seats. The game begins when all seats are filled, or the host can begin after three guests have joined. Players receive individual private hands and a shared server-authoritative turn sequence. Joins close when the match starts. The room code and session credentials allow reconnection. Every participant must approve a rematch.

### Group contract rules

- Players begin with 10 cards each, dealt privately. Rounds start with the next player clockwise, rotating across all participants.
- Each turn consists of one draw followed by either laying the complete contract or discarding one card.
- Only the player who lays advances their personal mission. All other players remain on their current mission and receive penalty points based on their own unplayed hands.
- The first player to complete their final mission wins. The existing first-to-three match-series ledger works for any number of seats.
- Five-suit Crown Circuit's wild rank still changes by round. The original house variants, not branded commercial games, remain unchanged in all other respects.
- Opponents' hands never leave the server; all group states have per-seat projections. Online moves require valid private session credentials and matching revisions.

### Group presentation improvements

- Responsive avatar seat rail: current-turn glow, seat connection information, personal card/tile count or contract score.
- Contract leaderboard shows each player's mission and penalty points on the desktop and phone layouts.
- Clear round-winner notification and next-round guidance; group win text names the actual player, not a generic opponent.
- Lobby descriptions identify the eight supported group games and explain why mixed tournaments remain two-player.

### Verification

Use `npm test` and `npm run build`. Phase 14 adds contract-engine tests at 3, 4 and 6 seats, end-of-round penalty tests, per-seat confidentiality checks, rematches and restart recovery, plus HTTP tests for all four new group titles with six authenticated clients.

**Not yet verified:** physical-phone browser testing. **Not configured:** paid PostgreSQL durability in Render; until this is enabled, active rooms may be lost during service restarts. Live deployment requires verifying the new GitHub commit and Render deploy.

---

<a id="phase-13"></a>

## Phase 13 — archived release notes

> *Historical release note, originally maintained as `README_PHASE13.md`.*

Version **1.3.0** — 22 October 2026

### New genuine 3–6-player private tables

Group-compatible original variants: **Eight Shift, Stack Run, Malice Duel and Tile Royale**. Select **Play with friends**, choose a supported game, select the number of seats (2–6), and host the game. Each phone opens the same six-character invite code. The host may begin a group game at 3 or more occupied seats, or play begins automatically when the selected capacity is reached. Joining after launch is not available; an existing player may reconnect with their seat credential.

The server alone controls cards, draws, actions, turn sequence, final scores and rematches. All other participants' hands are redacted in the recipient's view. Every seat has a separate token; no player can act as another seat. Match-series wins are tallied for every participant; a rematch requires approval from every player in the room. Draws award no series point.

**Still 2-player:** Phase Quest, Contract Club, Crown Circuit, Number Ladder, Shanghai Nights and Low Glow. The mixed-ten-game tournament remains a 2-player-only feature. This is deliberate: these engines have contract-progress and shared scoring rules that cannot simply be made 6-player by changing the lobby count.

### Gameplay and bot balance improvements

- **Tile Royale**: corrected score-tie result after a fully stalled draw pile. Three bot difficulty levels, including a wider legal-meld search at Expert, without reading an opponent's rack.
- **Low Glow**: three bot difficulty levels. Expert favours revealed opportunities to clear a matching column without inspecting hidden grid values.
- **Eight Shift**: an exhausted, blocked draw pile can no longer trap a game forever. If everyone consecutively has no playable card and cannot draw, the server awards the win for the lowest hand score, or records a draw on a tie.
- **Gameplay compatibility**: existing solo bots and all ten two-player engines are retained.

### Verification and limitations

Run `npm test` for full automated testing and `npm run build` for packaged web and offline assets. Automated coverage includes groups of 3, 4 and 6, turn rotation, projection of private hands, host-only starts, concurrent action rejection, idempotency, all-seat rematch voting, saved room recovery, HTTP endpoints, authenticated event streams and bot fairness.

**Not yet verified on physical phones**: real-world usability and network quality. The Chromium test harness was prevented from opening localhost by its administrator restrictions; no graphical browser acceptance pass is claimed. Render PostgreSQL still needs separate configuration and possible charges; memory-only rooms are not durable across service restarts.

Hosted games can be played on different phones or households via the existing Node web service. This is *not* public matchmaking or an open lobby.

---

<a id="phase-12"></a>

## Phase 12 — archived release notes

> *Historical release note, originally maintained as `README_PHASE12.md`.*

Version 1.2.0 · 22 October 2026

### Completed

- **Ten-game HTTP integration:** two independent player credentials join each game, receive their own seat-specific state and never receive the other player's private hand or raw session token.
- **Live event-stream check:** a guest's authenticated event stream receives the updated game revision after the host moves, without showing the host's cards.
- **Network retry protection:** repeating an action ID does not apply the move twice; stale revisions return HTTP 409.
- **Restart rehearsal:** ten local games are saved into a temporary room-snapshot file; one active game restarts with the same move revision, private sessions and retry acknowledgement. This tests recovery logic, **not cloud disk durability**.
- **Truthful server health:** `/health` reports `storage`, `durableStorage`, and `databaseConnected`. A configured PostgreSQL URL only counts as durable when a live database ping succeeds. Failed pings produce HTTP 503. Filesystem storage remains `durableStorage: false` because this health endpoint cannot guarantee that Render will preserve the volume.
- **Safer file serving:** `/src/server/` is not served to browser clients.
- **Active-game persistence warning:** if a table lacks PostgreSQL-backed storage, the player sees a reminder during play, not just in the waiting lobby.
- **Optional Playwright two-mobile-context script** in `scripts/browser-acceptance.py`, which can be run locally against a server. It was not executable within the assistant's restricted browser environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). Browser and physical-device success are **not** claimed.

### Verification

```
npm test
npm run build
npm run test:network
```

### Cloud durability remains unactivated

Render `STACKHOUSE` currently has **no Render PostgreSQL database**. No paid database has been created or activated. The production game will lose in-memory rooms on service restart. To enable restart recovery, first approve a PostgreSQL service and its monthly price/retention terms; then securely set `DATABASE_URL` on the `STACKHOUSE` web service, redeploy and confirm the health endpoint returns `storage: postgres`, `durableStorage: true`, `databaseConnected: true`.

**Do not use `ROOM_DATA_FILE` on the service's ephemeral filesystem** as a substitute for a durable disk.

### Physical-device acceptance still required

Invite one iOS Safari player and one Android Chrome player from two different networks. Check room joining, both private hands, turn-by-turn moves, card and tile reordering, reconnection during a temporary outage, rematches and mixed-game series. With durable Postgres enabled, restart Render midgame and verify both seats restore. Until then, mark restart recovery as a local rehearsal only.

---

<a id="phase-11"></a>

## Phase 11 — archived release notes

> *Historical release note, originally maintained as `README_PHASE11.md`.*

Version 1.1.0 · 22 October 2026

### Improvements

- Every create, join and move is processed serially. Two requests with an identical room revision cannot both change the table.
- All mutations roll back in memory if the persistent write fails. Clients do not receive a successful move or score for a failed write.
- Optional PostgreSQL snapshots (`DATABASE_URL`) retain hidden card state, seats, hashed session tokens, idempotency receipts, tournament results and mutual-rematch approvals across service restarts.
- PostgreSQL uses an atomic generation check to detect a stale second server instance, rather than overwriting another process's saved room data.
- The `/health` endpoint reports the configured storage mode and whether PostgreSQL durability is enabled, without revealing credentials.
- The waiting lobby warns players if tables are memory-only or depend on unverified filesystem storage.
- Additional automated tests cover overlapping moves, lost database writes, lost acknowledgements, restart recovery and concurrent database writers.

### Enabling genuine restart recovery on Render

Phase 11 does **not** provision a database or incur a new bill. To activate PostgreSQL persistence:

1. Provision a PostgreSQL database (confirm the cost and retention policy first). Use a private internal connection URL when Render offers it.
2. In the `STACKHOUSE` Render web service, add secret environment variable `DATABASE_URL` containing that database connection URL. Do **not** commit the value to GitHub.
3. Remove `ROOM_DATA_FILE` if present. The app rejects ambiguous dual-store configuration.
4. Redeploy and verify `/health` reports `storage: postgres` and `durableStorage: true`.
5. Create a private two-person game, make a move, record both players' saved seat tokens on their own devices, restart the service, and confirm both devices restore their separate hands, score and next turn.

The PostgreSQL `pg` package is installed on Render during deployment through `package.json`. Existing memory-only operation needs no database. The local development/test environment does not require a PostgreSQL connection. **Database integration is unit-tested with a simulated adapter; a real PostgreSQL failover test remains outstanding until a database is connected.**

**Architecture limits:** Exactly one live application instance is supported for game updates and SSE/presence. Generation checks prevent silent overwrites but do not synchronise multiple instances. No public matchmaking, player accounts or global leaderboards are added.

### Acceptance checklist (physical devices)

1. Start a Games Night Mix with two phones in separate networks; verify invite code, avatars and private hands.
2. Draw/play/discard on alternating phones; every move must appear once and only once.
3. Disable Wi-Fi on one phone, reconnect over mobile data, and check that the same turn and hand return without duplicate moves.
4. Refresh both phones independently, confirm the right player seat and score persist.
5. Finish a match, ask for rematch on one phone, cancel the vote, then mutually approve; the next game and running scoreboard should match on both devices.
6. With PostgreSQL activated, restart Render during a match and confirm full round/score recovery. Without PostgreSQL this test will intentionally fail and must not be marked passed.
7. Repeat with iOS Safari and Android Chrome and review accessibility, colour contrasts, card spacing and reduced motion.

Run `npm test` and `npm run build` for the code checks.

---

<a id="phase-10"></a>

## Phase 10 — archived release notes

> *Historical release note, originally maintained as `README_PHASE10.md`.*

Version 1.0.0 · Private two-person games-night release

### The new feature: games across different tables

Private rooms offer two formats:

- **One game:** the existing first-to-three-wins series; consensual rematches replay the same game.
- **Games Night Mix:** the host chooses the first of ten games. After every completed match, both players must request a rematch to advance to the *next different game*. The room code, player seats and scores remain unchanged. Three match wins crown the champion. Draws count towards the match history without awarding a win. Following a champion, both players can agree to a fresh series, starting again with the host's original choice. If draws extend a series, the ten-game cycle repeats.

The server selects the next game and deals cards, prevents duplicate match scoring, and redacts opponents' private information. Both phones share one server-owned scoreboard and recent per-game results. A session can be resumed with the saved seat token while the room remains available.

### Solo opponents

The home page offers **Easy / Standard / Expert** for Stack Run, Malice Duel, Number Ladder and Eight Shift. Easy makes straightforward moves; Standard is the existing greedy bot; Expert uses alternative hand/planning scores on supported games. Expert is a heuristic, *not* a guaranteed winning AI and does not inspect hidden opponent hands. The other six games continue with their existing standard House Bot. Your setting remains in this device's browser storage.

### Validation

Run `npm test` and `npm run build`. Automated tests cover mixed tournament selection, score retention, consent, server reload using an explicitly configured storage file, private-hand masking, input validation, HTTP creation, and new bot difficulty settings. A standalone offline edition can be opened from `PLAY-OFFLINE.html` (bots only).

### Important live hosting limitation

Your current Render service has no verified persistent room storage. In-memory room sessions and scores disappear when the server restarts or is redeployed. The source supports atomic JSON snapshots by setting `ROOM_DATA_FILE` **to a genuinely durable filesystem**, but a path in an ephemeral Render container does not solve this. Configure a real persistent volume or database before promising restart recovery. This phase does **not** migrate storage to a managed database. Server capacity remains a single Node process with private two-person rooms; it is not public matchmaking or a public leaderboard.

Real physical-phone, network-switching, screen-reader and long-duration two-person acceptance tests still need to be performed. Automated API tests and simulated room clients are not substitutes for that work.

---

<a id="phase-9"></a>

## Phase 9 — archived release notes

> *Historical release note, originally maintained as `README_PHASE9.md`.*

**Stackhouse Social v0.9.0** · All ten existing games remain available.

### New in Phase 9

- **Best-of-five-style private series, first to three match wins:** The server keeps a score between invited players across consensual rematches. Drawn matches count but do not award a win. The current champion is announced and both players can agree to start a new series with scores reset.
- **Per-series match history:** Up to 12 most recent results, with a compact scoreboard shown on each player's phone. The server exposes only public match results and never hands, stockpiles, tokens or confidential card data.
- **Resilient scorekeeping:** An awarded result is keyed to a server-generated match number, so duplicate network requests, reconnects and persistence snapshots cannot count a win twice. Legacy rooms without a scoreboard receive clean default scores.
- **Solo victory book:** On each device the browser records wins, losses and draws across all ten games. The home screen shows total wins and each table displays its personal best wins. Solo match IDs survive refreshes and prevent the same completed game from being counted twice. Solo history stays local to that device/browser.
- **Better Eight Shift bot:** Considers the follow-up suit distribution in its own hand instead of playing the first legal card. Prefers regular cards to wild eights whenever possible; makes no use of private opponent cards.
- **Up-to-date offline edition:** The deployment build now regenerates and serves `/PLAY-OFFLINE.html` from source. This standalone bot edition works without the Node server once saved to a device.

### Run and verify

`npm test` validates room privacy, session results, consent, reloading, idempotent moves, user interface, bot play, and all ten engines. `npm run build` generates `PLAY-OFFLINE.html` and `dist/`; `npm start` hosts the online version and the standalone file. Automated browser smoke testing is also recommended on mobile and desktop.

#### Limits

Private tables still support **two people**. Public matchmaking, multi-room tournament brackets and account-based leaderboards are not implemented. Persistent live rooms on Render still require `ROOM_DATA_FILE` on durable storage; if unset, table scores are lost when the server restarts. Physical-device multiplayer testing remains outstanding.

### Verification

The Phase 9 automated suite passes 92 tests. Chromium browser navigation is blocked by the current execution environment, so mobile layout and two-device visual acceptance testing must still be completed on actual devices. The existing private-room API integration tests cover two independent authenticated clients and live event streaming.

---

<a id="legacy-guide"></a>

## Original project guide and early phases (archived)

> *This is the original `README.md` preserved for completeness. Its older “current release”, test counts and hosting statements are historical. The opening sections of this consolidated document supersede those statements.*

> **Current release: v1.6.0 — Phase 16 rules and accessibility corrections.** See [Phase 16 release notes](#phase-16) and the [independent release-validation checklist](#release-validation).

## STACKHOUSE SOCIAL — Previous releases

**Eight private multiplayer tables now support 2–6 people:** **Eight Shift, Stack Run, Malice Duel, Tile Royale, Phase Quest, Contract Club, Crown Circuit and Shanghai Nights**. Number Ladder and Low Glow remain head-to-head; a Games Night Mix rotation continues to require exactly two players. See [Phase 13 release notes](#phase-13) for verified coverage, limitations and testing.

- Host a room, select the supported table and seat capacity (2–6), then share the same invitation link with friends. For groups of 3–6, the host can start once at least three players are seated, or the game starts automatically when the table fills.
- Each participant has private cards, an authenticated personal view, independent turn controls and an individual avatar. Turns cycle through all participants; a full-table rematch requires **everyone's consent**.
- Game-night series track wins per person. Existing two-player rooms, solo bot play and established rules remain compatible.
- Tile Royale and Low Glow now have Easy / Standard / Expert computer opponents; six games offer difficulty settings.
- Eight Shift resolves an otherwise blocked game when nobody can draw or play; Tile Royale correctly scores tied exhausted racks as draws.
- **Cloud permanent storage is not configured:** the existing Render service can still lose rooms during a restart. Real physical-phone acceptance has not been completed, and the graphical browser harness in this environment was blocked.

Run `npm test` and `npm run build` (Node 20+). Online multiplayer requires `npm start` or a running Node server; the local `PLAY-OFFLINE.html` is bot-only.

---

## STACKHOUSE SOCIAL — Phase 12: multiplayer acceptance (v1.2.0)

See [Phase 12 release notes](#phase-12). Automated two-client HTTP/SSE tests cover all ten games, saved-state restart rehearsal and readiness reporting. Cloud PostgreSQL storage is **not active**, and physical two-phone testing remains outstanding.

---

## STACKHOUSE SOCIAL — Phase 10: Games Night Mix (v1.0.0)

See [Phase 10 release notes](#phase-10) for mixed-game tournaments, selectable bot challenge levels and production limitations.

---

## STACKHOUSE SOCIAL — Phase 9: Games Night Series (v0.9.0)

See [Phase 9 release notes](#phase-9) for match-series scoring, solo records and improved bot play.

---

## STACKHOUSE SOCIAL — Phase 8: Make It Fun (v0.8.0)

The ten games are unchanged; Phase 8 improves how they *feel* on both phones and desktop.

- **Guided turns:** Every game has a short "Your next move" prompt that updates with the actual stage of the game, chosen cards, selected tiles, or turn ownership. The server remains authoritative for online legality.
- **Moving cards and tiles:** New cards enter with short staggered dealing animations. Personal hand reordering uses a FLIP position animation so cards visually slide into their new slots. This is presentation-only: engine order and hidden cards are unchanged.
- **Richer table sounds:** Small synthesised effects distinguish dealing, sorting, progress, completed rounds and wins. Sounds remain **opt-in and off by default**, and do not require downloads.
- **Optional lounge ambience:** A separate ♫ switch enables a very quiet sustained musical pad, only while playing. It stops on the lobby and when the tab is hidden. Browser audio availability is handled gracefully.
- **Game-specific moments:** Correct progress earns small feedback messages; completed contracts, cleared tile racks and wins receive extra emphasis. No fake scores or gameplay advantages are awarded.
- **Victory celebration:** A brief gold flourish on successful banners, with a reduced-motion fallback. No modal interrupts the next round.
- **Accessibility:** High contrast prompts, explicit focus outlines, accessible switch labels, motion respecting `prefers-reduced-motion`, and audio independent from gameplay.

To build: `npm test`, `npm run build`, `npm run build:offline`. The latter creates a complete self-contained local bot file. Online play requires `npm start` or a Node Render deployment. Physical-phone feel and multiplayer acceptance testing are still outstanding; automated tests do not replace them.

---

### Phase 7: Reliable private tables (v0.7.0)

- Every browser action carries a cryptographically random ID. The server holds a bounded, seat-scoped acknowledgement ledger, so retries after a lost network response cannot deal, draw or play twice. Reused IDs with different payloads are refused.
- The browser automatically retries temporary network failures using **the same action ID**, refreshes authoritative state after errors, and ignores stale server updates.
- The private-table stream reconnects after interrupted connections and after 55 seconds with no traffic, including heartbeat traffic. Players reconnect using their previously saved seat token.
- Completed online games offer a **Request rematch** control to both players. One player can withdraw their request; a new game starts only when **both** request it. The rematch is dealt afresh by the server, keeping avatars and room codes.
- The private table now shows a prominent accessible **Your turn / Opponent’s turn / Match complete** indicator.
- Automated Node tests cover action retries, races, guest/host consent, cancellation, persistence and HTTP conflict responses. **Actual separate-phone testing is still required.**
- Saved server rooms require `ROOM_DATA_FILE` pointed at persistent storage. Render instances with memory-only storage **lose open multiplayer rooms on restart**. Solo resume remains browser-local.

## STACKHOUSE SOCIAL — Ten Tables (Phase 7: Multiplayer Reliability)

### Phase 6: Resume games and improved hand organisation

- **Continue solo match:** Every legal move, bot turn and new match is saved automatically in this browser. The home page offers **Continue [game]** after refreshing or coming back. A new solo match replaces the previous saved match. Saved progress remains on that device/browser and is not shared with online opponents.
- **Arrange → Undo:** Repositioned, automatically sorted or touch-arranged cards/tiles can be restored to the previous arrangement using **↶ Undo** (up to 20 changes per match). Undo affects only visual ordering and can never undo a played card or server action.
- **Sort suit/colour:** Where available, organise your hand by suit or colour as well as the existing number sort. Number Ladder and Low Glow retain fixed slot layouts.
- **Private rooms:** Online matches continue to use server-authoritative state; local save/reordering never changes server cards or turns. Room reconnection is still supported separately.
- **Validation:** Tests include state snapshot round-trip, bad/old/corrupted saves, and UI controls. Browsers with local storage disabled can still play; resume is unavailable in that case.




### Hand and tile reordering — Phase 4.1

**New in this update:** A player's hand can be rearranged visually in **Stack Run**, **Malice Duel**, **Phase Quest**, **Contract Club**, **Crown Circuit**, **Shanghai Nights**, **Tile Royale** and **Eight Shift**.

- **Mouse or finger:** Drag any card/tile and drop it over the position you want. On phones, drag across the rack; cards and tiles animate and the drop position is outlined.
- **Tap alternative:** Select **Arrange**, tap the card/tile to move, and then tap its desired position. Select **Done arranging** to go back to normal gameplay. While in Arrange mode, taps do not play or discard cards.
- **Quick sort:** Choose **Sort ↑** to order the hand by number (with colour/suit as a tie-breaker).
- **Keyboard:** Focus a hand card/tile and press **Alt + Left/Right arrow** to shift its displayed position.
- **Independent display:** Reordering is client-only; it does not change hand indices in the engine, hidden information, turn state or the server's canonical data. Game actions still use the original card/tile identity.
- **After draws:** Any newly drawn card/tile appears at the end of your displayed hand; existing cards keep their chosen positions. Arrangements reset when starting a new game.

**Why not Number Ladder or Low Glow?** Their card slots are fixed *game positions*, not an unordered hand. Reordering those slots would invalidate the puzzle rules, so those grids deliberately remain fixed.

Tests: `npm test` (including hand-order and solo-save correctness tests). Build portable offline edition: `npm run build:offline`. Browser tests were run in Chromium for drag, sorting and tap-to-arrange on all four interface types, plus narrow mobile-width rendering. Actual physical-device acceptance testing remains outstanding.


**Ten playable original card and tile variants.** This is a phone-first private games-night collection with 16 avatars, bot opponents and private server-authoritative two-player and selected 3–6-player rooms.

### Play immediately

Open **`PLAY-OFFLINE.html`** in a browser. This self-contained HTML file embeds the graphics and code for all ten single-player bot variants. No server, installation or internet access is required (font fallback works offline). The standalone file **does not support private online multiplayer**.

To run the Node multiplayer edition (Node 20+, no dependency installation required):

```bash
npm start
## Open http://localhost:4173 on the host computer.
## For another device on your local network, use http://HOST-LAN-IP:4173.
```

Choose **Private table** to host a game, then share the room code or invite link with another player. Online hands and decks are held by the server; clients receive only their allowed view. Real two-device acceptance testing is not yet complete.

### All ten games

| Game | ID | Genre and implemented house rules |
| --- | --- | --- |
| **Stack Run** | `stack-run` | Sequence shared 1–12 piles; clear your stockpile |
| **Phase Quest** | `phase-quest` | Ten escalating set/run/colour contracts |
| **Malice Duel** | `malice-duel` | Three shared stockpile-sequencing piles |
| **Contract Club** | `contract-club` | Seven contract-rummy stages |
| **Crown Circuit** | `crown-circuit` | Eleven stages, five suits and rotating wild ranks |
| **Number Ladder** | `number-ladder` | Swap ten numbered cards into strict ascending order |
| **Shanghai Nights** | `shanghai-nights` | Seven progressive contract stages; no buying discarded cards |
| **Tile Royale** | `tile-royale` | **New:** lay sets or same-colour runs, extend existing groups, and empty fourteen tiles; no full-table rearranging |
| **Low Glow** | `low-glow` | **New:** 3 × 4 hidden-card grids, draw/swap/reveal, clear matching columns, lowest total after **four rounds** wins |
| **Eight Shift** | `eight-shift` | **New:** match suit or rank, wild eights select the suit, draw once then play or pass; empty your hand |

These are **independently implemented house-rule variants**, not official releases or exact replicas of any third-party branded games. No real-money gambling functionality.

### Assets and interface

- Original **Stackhouse Social** logo, lounge artwork and sixteen individually selectable character portraits.
- Distinct tables for sequencing, contracts, racks, sets/runs, hidden-card grids and card matching.
- Responsive desktop and phone controls, focus-visible outlines, reduced-motion styles, muted-by-default optional sounds, UK English wording.
- Multiplayer invite flows, server-validated turns, auto-reconnection using browser-local player tokens, private opponent hands and card grid redaction.

### Run builds and automated checks

```bash
npm test             # Phase 6: 70+ automated tests
npm run build        # Assemble static dist/ (no multiplayer backend by itself)
npm run build:offline  # Recreate self-contained PLAY-OFFLINE.html
```

Tests cover core game legality, card inventory, deterministic bots, secure room projections, turn/revision validation, API and SSE flows, plus a DOM smoke harness and offline bundle execution. The latest builds were also opened in desktop and phone-sized Chromium views; the new Tile Royale and Low Glow layouts and ten-game lobby were inspected. This is **not** a full real-world two-phone acceptance test, multi-browser audit or production load test.

### Hosting notes

The provided `render.yaml` specifies a **Node web service**, not a static website. To publish live multiplayer, put this project in its own GitHub repository and configure Render to build with `npm run build` and start with `npm start`. The `/health` route returns application status. For persistence through server restarts, configure a protected storage volume and `ROOM_DATA_FILE`, or migrate to a managed database. This server is designed for a **single Node process** with private two-player rooms, not public matchmaking or large-scale production traffic. Rotate/restrict infrastructure credentials appropriately and review hosting costs.

**Current deployment:** GitHub repository `connex222/STACKHOUSE` is connected to a Render web service at https://stackhouse-m50w.onrender.com. Render uses the Node server build. Verify its latest deploy status after any push.

### Outstanding development work

1. End-to-end multiplayer acceptance on two actual phones (including reconnects, switching Wi-Fi/mobile networks and stale moves).
2. Production hardening: reliability under concurrency, longer-term persistence, abuse protection, accessibility and extra browser coverage.
3. Optional enhancements: animations, game history/rematches, more skillful AI, house-rule selectors, and room hosting refinements.


### Phase 11 (v1.1.0)
See [Phase 11 notes](#phase-11) for the opt-in PostgreSQL durable-room backend, concurrency safeguards, deployment conditions and real-phone acceptance checklist. The existing Render service is **memory-only until DATABASE_URL is configured**; no new database has been provisioned.

### Phase 18 audio

See [Phase 18 notes](#phase-18) for the sound bank, Sonilo/Mirelo production provenance and provider-asset import status.



## Audio playback hotfix — 22 October 2026

A production defect made the web server reject `.mp3` requests with HTTP 403 even though game logic correctly requested the packaged sounds. The static asset allow-list now admits `.mp3` and `.m4a`, served as `audio/mpeg` and `audio/mp4`. Audio playback failures are reported to the existing procedural tone fallback rather than silently swallowed. Gameplay audio now defaults to on for first-time visitors, but preserves a returning player's explicit mute preference; browser autoplay restrictions still require a click or other user interaction. The header displays **Sound on/off** and offers a **Test** button, which enables audio and plays a sample. Sound samples are intentionally short and at moderate volume. Existing generated Sonilo and Mirelo masters remain untouched.


## Phase 19

**Audio reliability update (v1.9.0)**

- A **Volume** slider in the header adjusts the sound-effects level from 0 to 100%, defaults to 85%, and remembers the setting on that device. Ambience remains independently controlled.
- The **Test** button explicitly enables sound and asks the browser to play a victory sample. A status line reports whether the browser accepted playback, blocked it, or required the backup synthesised tone. Browser playback confirmation does not verify speaker output or the physical phone's silent/media-volume settings.
- The mobile audio engine no longer permanently blacklists a sample after a temporary `NotAllowedError` (autoplay policy). Further user taps can retry. Unreadable media still uses the fallback rather than interrupting gameplay.
- The test button resets cached media failures so transient download or device errors can be retried; the regular game cues retain throttling and respect mute and volume zero.
- `tests/phase19-audio-recovery.test.js` covers permission locks, decoder failures, zero/maximum volume, user controls, and replay. `scripts/audio-browser-smoke.py` checks a direct Chromium user gesture, volume, mute and playback promise or backup tone.
- GitHub's accessibility workflow also runs the audio smoke test. Real iPhone and Android physical-speaker listening remains required before a full audio sign-off.
- The existing Sonilo and Mirelo recordings in `assets/audio/masters/` and the three shortened production cues are preserved. This phase does not replace or claim to remix provider recordings.

If the sound-status line says **Test sound played** but you still hear nothing, check the device's *media volume*, Bluetooth/HDMI audio output selection, and the physical mute/silent switch. A successful play promise confirms browser playback started, not that speakers emitted audible sound.


## Phase 20 — Audible audio and diagnostic checks (v2.0.0)

- **Measured sound levels:** The original shipped playable MP3s peaked between approximately -14.6 and -20.3 dBFS. This could make the card and button cues very quiet on a phone or television.
- **Level correction:** `node scripts/normalise-audio.mjs` uses FFmpeg to lift quiet playable effects near -5 dBFS without exceeding the safe limiter ceiling. The generated providers’ **master recordings are never modified**. A GitHub workflow applies the same correction to the actual repository audio assets, including the imported Mirelo samples. This changes recorded gain, not your saved user volume.
- **Two independent sound tests:** **Test** plays a recorded sample; **Tone** synthesises a deliberately audible diagnostic signal through Web Audio. If Tone works but Test does not, investigate the file/browser media path. If neither is heard, check device volume, speaker selection and browser audio permissions. A successful browser playback request is *not proof* that a physical loudspeaker is audible.
- **Browser controls:** Sound may require a gesture after loading a page. Keep game effects enabled and volume above zero, then press Test or Tone. No sound is ever required to progress game state.
- **Verification:** The normaliser includes post-processing measurements and is safe to run repeatedly. Audio regression tests and Chromium smoke tests cover distinct recorded/tone paths and volume changes.

Outstanding: physical phone/TV speaker verification and permanent multiplayer storage.


## Phase 21 — Gameplay quality and pacing (v2.1.0)

This phase begins a selective redesign rather than adding titles. Previously saved Full Match rooms and the original ten-game rules remain available.

### Quick Match — four contract titles

Hosts and solo players may choose Full or Quick. Full retains all missions and ends when one player completes the final contract. Quick runs **two deals per seated player** (four deals for two players, twelve for six), ranking by **contracts completed**, then **fewest accumulated penalty points**. A tie on both metrics is a draw. Quick is not used for Games Night Mix, which retains full rules for consistency.

### Shanghai Nights discard buying

A player who deliberately draws from the deck declines the face-up discard and opens a purchase opportunity to the waiting players. A waiting rival may buy it once per deal, taking the discard **and one face-down penalty card**. The active player's turn continues uninterrupted. The window closes when the active player discards or one rival makes the purchase. The server alone validates the buyer's seat, remaining supply, phase and purchase limit; opponent hands remain hidden. In solo play, the House Bot can buy a card that helps its sets or runs.

### Tile Royale — truthful finishing rules and public final scores

The first emptied rack still wins immediately. If the tile pool runs dry and everybody stalls, lowest rack points (20 per wild, face value otherwise) wins; exact ties draw. Six-player playtests with a simple strategy heavily favoured this type of finish, so the home, rules and in-game guidance now state it plainly. **No unverified claims of rebalancing success** are made: altering the core tile economy and enabling table rearrangement require separate comparative playtesting. Full rack totals are revealed to all players only after a points-finish, in each player's own displayed seat order.

### Remaining Phase 21 design work

Contract Club is still a first-to-lay house-rule game, not a fully fledged lay-off rummy. Phase Quest and Crown Circuit use distinct mission sets, Crown's five suits and rotating wild rank; their deeper mechanics have not been redesigned in this initial release. Comprehensive measured human pacing and tile-economy balancing remain future work.


## Phase 21 continuation — Contract Club, Crown Circuit and group Tile Royale (v2.1.1)

The Phase 21 follow-up is an intentional **house-rule change** (not a promise to reproduce the rules of any branded rummy/tile game). Existing in-progress matches should finish before a deployment because the new gameplay semantics are different.

- **Contract Club** has its own rummy flow: once a player draws and lays their assigned contract, the game continues. The public table displays their original sets/runs/colour melds; players who have laid may extend any valid shared meld one card at a time. Discard to finish the turn. First to empty their hand wins the deal. Each player may lay only one contract per deal, and everyone who lays progresses. All unplayed cards generate penalty scores at deal end. The server validates every extension and keeps undealt/private cards hidden.
- **Contract Club closing time**: if nobody goes out after **ten completed turns per player**, compare unplayed-hand points; lowest points wins the deal, exact ties draw. This guarantees that a long deal finishes. Matches still use the existing Full Journey (seven contracts) or Quick Match (two deals per player).
- **Crown Circuit**: the existing round-rotating wild rank is unchanged. To make retention decisions more distinctive, unplayed court cards (11–13) now score **15 penalty points** and all wilds **25**, instead of treating all cards strictly at face value and all wilds as 20. Phase Quest, Contract Club and Shanghai Nights keep their previous point values.
- **Tile Royale, five or six players**: simulated 36 seeds at each table size with a simple standard bot showed that merely reducing initial racks from 14 to 12/11/10 did *not* reliably improve rack-clearing and in fact extended matches. We therefore retain the 14-tile racks. Group play is now a clearly labelled **Points Sprint**: each player has exactly eight turns; emptying a rack wins instantly, otherwise the lowest remaining rack points wins, ties draw. Smaller tables retain the previous exhausted-pool endgame.
- **Accessibility**: shared meld buttons are keyboard-operable, identify their owners and types, and are disabled unless the chosen card legally extends them.

**Acceptance:** Independent engine/server tests cover early melds, laying off on other players' groups, invalid move rejection, privacy, fair penalties, the deal turn cap, Crown Circuit card values, and equal-turn Tile Royale conclusions. The physical-device and permanent-storage requirements remain outstanding.


<a id="phase-22"></a>

## Phase 22 — House Bot and interface polish (v2.2.0)

- **Contract-game bot difficulty across all four games:** The Easy House Bot prioritises dumping high-penalty cards and mainly takes a face-up discard to complete a contract. Standard looks for a better mission-specific draw and keeps complementary cards. Expert uses a higher-weight estimate of progress toward the current sets, runs and colour collections while preserving high-value wilds. The Shanghai Nights bot's purchase decision also uses the selected difficulty. This is deterministic heuristic AI, not machine learning or a claim of optimal play.
- **Privacy:** The bot examines its own hand, the public discard and its assigned contract, never other players' unrevealed cards. The multiplayer server still validates every action; bot difficulty only applies to local solo play.
- **Cleaner header:** The prominent Sound on/off toggle and optional lounge ambience remain accessible. Volume, Test recording, Test speaker and status move into a labelled **Audio settings** disclosure so they no longer crowd the navigation. Audio settings remain available on phone, PC and TV.
- **Before-play tutorials:** Every home game tile now offers a **How to play** button, opening the same full instructions used during a match. Instructions are not dependent on starting a game.
- **Validation:** New engine tests cover difficulty selection, non-use of opponent secrets, legal contract turns and presence of the audio and tutorial controls. Existing gameplay regressions are retained. Passing automated tests does **not** replace human difficulty balancing or real-device audio checks.

**Remaining release issues:** durable multiplayer storage, physical-phone testing, native zoom and assistive-technology acceptance. Do not treat these as complete.

## Phase 23 — Games Night TV & host controls (v2.3.0)

**Purpose:** Run a private games-night table with a read-only shared TV/laptop display without exposing any player's hidden information. No new game modes or changes to house rules have been introduced in this phase.

### TV spectator display

1. Host a private online table (two to six players according to the game).
2. The **host (seat 1)** presses **Create TV display link** in the lobby or at the playing table.
3. Paste the copied link into the television's browser, a connected computer or another display, and open it. There is no need to join as a player.
4. The TV displays player portraits, live turn and connection indicators, match wins, first-to-three series standing, draw-pile counts, public shared cards/piles and relevant round progress. It never shows a hidden card or tile identity from any player's hand, rack, stockpile or undrawn deck.
5. The host may choose **Replace TV link** to rotate the spectator credential (immediately revoking previous links), or **Disable TV link** to close spectator access entirely.

**Security model:** the spectator URL stores the independent, random **TV-only token in the URL fragment** (`/tv.html#room=ABCDEF&key=…`), not the query string. The server keeps only its SHA-256 hash, and the TV client authenticates API/SSE connections with an `Authorization` header. TV endpoints are **read-only** and only return a strict public-information allowlist, independent of `projectGame()`, which reveals the authenticated player's cards. A TV credential cannot join rooms, take turns, pause play, or change a player avatar. The TV stream has its own connection quota and automatically reconnects after ordinary network drops; revoked links fail closed. Treat the TV link as private, even though it grants no player control.

**Host controls:** the host can **Pause table** and **Resume table** while a match is in progress. Pausing blocks server-side gameplay actions for every player (including rematch votes); it does not change scores or deck order. Only the host can resume. The host can still change their avatar while paused. Paused state and spectator-link hash are included in configured room snapshots; with the default Render memory-only service they will *not* survive an instance restart.

**Group competition:** the existing first-to-three series ledger and rematch-consent rule are retained, and the TV makes the standings visible to the whole room. A new match still requires every player to vote. The eight group games still support 3–6 players; Number Ladder, Low Glow and Games Night Mix remain two-player experiences. The table seats include the host: six players means host plus five friends.

**Verification:** `npm test` runs independent spectator redaction, permission, pause, link rotation/revocation, six-game reconnection and persistence-regression checks, plus a live HTTP/SSE acceptance test. `npm run build` also packages the TV HTML/CSS/client assets into `dist` while keeping the standalone bot edition intact.

**Outstanding for production release:** in-person TV overscan/readability tests, real multi-phone network tests, and connecting a durable PostgreSQL room store if continuous matches across Render restarts are required. Native screen-reader accessibility sign-off is also outstanding.


<a id="phase-24"></a>

## Phase 24 — Release acceptance and recoverable private seats (v2.4.0)

**Scope:** Stabilise the existing ten games, independent phone/tablet/TV connections, reconnection and host-controlled TV viewing. No new game rules or paid infrastructure.

**Fixed in this phase:** When a player reloaded their browser while a server was temporarily unavailable (including HTTP 503 or a network interruption), the earlier client incorrectly removed their saved player credential. The app now retains the seat, shows **Retry saved seat** with the original room code and offers **Forget this seat on this device** for shared devices. The stored token is invalidated only after a definitive HTTP 401 or 404 response. A game-stream HTTP 401 or 404 also stops its endless retry cycle and displays an actionable status instead.

**Automated acceptance:**

- `npm test`: regression coverage for HTTP sessions, spectator redaction, host pause/resume, six-player tables in all eight supported modes, and controlled restart using a local snapshot file. Local-file restart is **not** evidence of a durable Render installation.
- `python scripts/phase24-browser-acceptance.py`: hosted Chromium scenario with four independently authenticated simulated phone contexts (320, 375, 390 and 412 CSS pixels) plus a widescreen TV context; create/join, public TV display, host pause/resume, deliberate HTTP 503 during refresh, retry saved seat, TV credential revocation, browser script errors and horizontal overflow. Run this in GitHub Actions or an unrestricted local network environment; it cannot replace testing on physical hardware.
- `/health` returns `storage`, `durableStorage`, `databaseConnected`. Green HTTP 200 on an in-memory server does **not** mean match persistence is safe on restart.

### Physical games-night acceptance checklist — must be signed off by a person

Use the deployed URL on at least one real iPhone (Safari), one Android (Chrome), a desktop browser and a TV browser or connected laptop. Do not share real invite links publicly or take screenshots showing session credentials.

1. **Create and join:** On one phone host Eight Shift for four players, join independently on other devices, and check all four names and distinct hidden hands. Repeat six-player joining for Tile Royale and one contract game.
2. **Turn privacy:** Confirm each phone only sees its own hand; the television shows public cards, turn and scoring only, with legible text from a normal viewing distance.
3. **Connectivity:** During a match switch an Android phone between Wi-Fi and mobile data, refresh it, and verify the same seat, cards, turn and scores return. Repeat while the server deliberately responds with HTTP 503 in a controlled environment (do not disrupt a real paid event).
4. **Host permissions:** Pause/resume on the host, confirm guest moves are prevented while paused, disable the TV link, and ensure the existing television stops receiving updates. Replace the TV link and confirm the previous one fails.
5. **Access and accessibility:** Test all critical controls with a keyboard, native browser 200% zoom, iOS VoiceOver and Android TalkBack, reduced-motion setting, touch target readability and colour contrast in bright rooms. Record device model, OS/browser version, pass/fail and defects.
6. **Audio:** Unmute and test the recorded sample, fallback tone, card/tile effects and volume slider on phones and TV speakers, including after switching away and returning to the browser.
7. **Recovery and hosting:** Confirm the current `/health` shows `durableStorage:false` until PostgreSQL is enabled. If restart survival is required, approve a database plan first, connect `DATABASE_URL` securely, then repeat the restart scenario on a test room (never on someone's active table).

**Release gates:** automated testing and a successful Render deployment are necessary, but **not sufficient**. Hold final multiplayer production sign-off until physical cross-device and accessibility checks pass and the persistence decision is documented. No chargeable PostgreSQL service is created automatically.
