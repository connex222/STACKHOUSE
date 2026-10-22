> **Current release: v1.6.0 — Phase 16 rules and accessibility corrections.** See [Phase 16 release notes](README_PHASE16.md) and the [independent release-validation checklist](README_RELEASE_VALIDATION.md).

# STACKHOUSE SOCIAL — Previous releases

**Eight private multiplayer tables now support 2–6 people:** **Eight Shift, Stack Run, Malice Duel, Tile Royale, Phase Quest, Contract Club, Crown Circuit and Shanghai Nights**. Number Ladder and Low Glow remain head-to-head; a Games Night Mix rotation continues to require exactly two players. See [Phase 13 release notes](README_PHASE13.md) for verified coverage, limitations and testing.

- Host a room, select the supported table and seat capacity (2–6), then share the same invitation link with friends. For groups of 3–6, the host can start once at least three players are seated, or the game starts automatically when the table fills.
- Each participant has private cards, an authenticated personal view, independent turn controls and an individual avatar. Turns cycle through all participants; a full-table rematch requires **everyone's consent**.
- Game-night series track wins per person. Existing two-player rooms, solo bot play and established rules remain compatible.
- Tile Royale and Low Glow now have Easy / Standard / Expert computer opponents; six games offer difficulty settings.
- Eight Shift resolves an otherwise blocked game when nobody can draw or play; Tile Royale correctly scores tied exhausted racks as draws.
- **Cloud permanent storage is not configured:** the existing Render service can still lose rooms during a restart. Real physical-phone acceptance has not been completed, and the graphical browser harness in this environment was blocked.

Run `npm test` and `npm run build` (Node 20+). Online multiplayer requires `npm start` or a running Node server; the local `PLAY-OFFLINE.html` is bot-only.

---

# STACKHOUSE SOCIAL — Phase 12: multiplayer acceptance (v1.2.0)

See [Phase 12 release notes](README_PHASE12.md). Automated two-client HTTP/SSE tests cover all ten games, saved-state restart rehearsal and readiness reporting. Cloud PostgreSQL storage is **not active**, and physical two-phone testing remains outstanding.

---

# STACKHOUSE SOCIAL — Phase 10: Games Night Mix (v1.0.0)

See [Phase 10 release notes](README_PHASE10.md) for mixed-game tournaments, selectable bot challenge levels and production limitations.

---

# STACKHOUSE SOCIAL — Phase 9: Games Night Series (v0.9.0)

See [Phase 9 release notes](README_PHASE9.md) for match-series scoring, solo records and improved bot play.

---

# STACKHOUSE SOCIAL — Phase 8: Make It Fun (v0.8.0)

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

## Phase 7: Reliable private tables (v0.7.0)

- Every browser action carries a cryptographically random ID. The server holds a bounded, seat-scoped acknowledgement ledger, so retries after a lost network response cannot deal, draw or play twice. Reused IDs with different payloads are refused.
- The browser automatically retries temporary network failures using **the same action ID**, refreshes authoritative state after errors, and ignores stale server updates.
- The private-table stream reconnects after interrupted connections and after 55 seconds with no traffic, including heartbeat traffic. Players reconnect using their previously saved seat token.
- Completed online games offer a **Request rematch** control to both players. One player can withdraw their request; a new game starts only when **both** request it. The rematch is dealt afresh by the server, keeping avatars and room codes.
- The private table now shows a prominent accessible **Your turn / Opponent’s turn / Match complete** indicator.
- Automated Node tests cover action retries, races, guest/host consent, cancellation, persistence and HTTP conflict responses. **Actual separate-phone testing is still required.**
- Saved server rooms require `ROOM_DATA_FILE` pointed at persistent storage. Render instances with memory-only storage **lose open multiplayer rooms on restart**. Solo resume remains browser-local.

# STACKHOUSE SOCIAL — Ten Tables (Phase 7: Multiplayer Reliability)

## Phase 6: Resume games and improved hand organisation

- **Continue solo match:** Every legal move, bot turn and new match is saved automatically in this browser. The home page offers **Continue [game]** after refreshing or coming back. A new solo match replaces the previous saved match. Saved progress remains on that device/browser and is not shared with online opponents.
- **Arrange → Undo:** Repositioned, automatically sorted or touch-arranged cards/tiles can be restored to the previous arrangement using **↶ Undo** (up to 20 changes per match). Undo affects only visual ordering and can never undo a played card or server action.
- **Sort suit/colour:** Where available, organise your hand by suit or colour as well as the existing number sort. Number Ladder and Low Glow retain fixed slot layouts.
- **Private rooms:** Online matches continue to use server-authoritative state; local save/reordering never changes server cards or turns. Room reconnection is still supported separately.
- **Validation:** Tests include state snapshot round-trip, bad/old/corrupted saves, and UI controls. Browsers with local storage disabled can still play; resume is unavailable in that case.




## Hand and tile reordering — Phase 4.1

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

## Play immediately

Open **`PLAY-OFFLINE.html`** in a browser. This self-contained HTML file embeds the graphics and code for all ten single-player bot variants. No server, installation or internet access is required (font fallback works offline). The standalone file **does not support private online multiplayer**.

To run the Node multiplayer edition (Node 20+, no dependency installation required):

```bash
npm start
# Open http://localhost:4173 on the host computer.
# For another device on your local network, use http://HOST-LAN-IP:4173.
```

Choose **Private table** to host a game, then share the room code or invite link with another player. Online hands and decks are held by the server; clients receive only their allowed view. Real two-device acceptance testing is not yet complete.

## All ten games

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

## Assets and interface

- Original **Stackhouse Social** logo, lounge artwork and sixteen individually selectable character portraits.
- Distinct tables for sequencing, contracts, racks, sets/runs, hidden-card grids and card matching.
- Responsive desktop and phone controls, focus-visible outlines, reduced-motion styles, muted-by-default optional sounds, UK English wording.
- Multiplayer invite flows, server-validated turns, auto-reconnection using browser-local player tokens, private opponent hands and card grid redaction.

## Run builds and automated checks

```bash
npm test             # Phase 6: 70+ automated tests
npm run build        # Assemble static dist/ (no multiplayer backend by itself)
npm run build:offline  # Recreate self-contained PLAY-OFFLINE.html
```

Tests cover core game legality, card inventory, deterministic bots, secure room projections, turn/revision validation, API and SSE flows, plus a DOM smoke harness and offline bundle execution. The latest builds were also opened in desktop and phone-sized Chromium views; the new Tile Royale and Low Glow layouts and ten-game lobby were inspected. This is **not** a full real-world two-phone acceptance test, multi-browser audit or production load test.

## Hosting notes

The provided `render.yaml` specifies a **Node web service**, not a static website. To publish live multiplayer, put this project in its own GitHub repository and configure Render to build with `npm run build` and start with `npm start`. The `/health` route returns application status. For persistence through server restarts, configure a protected storage volume and `ROOM_DATA_FILE`, or migrate to a managed database. This server is designed for a **single Node process** with private two-player rooms, not public matchmaking or large-scale production traffic. Rotate/restrict infrastructure credentials appropriately and review hosting costs.

**Current deployment:** GitHub repository `connex222/STACKHOUSE` is connected to a Render web service at https://stackhouse-m50w.onrender.com. Render uses the Node server build. Verify its latest deploy status after any push.

## Outstanding development work

1. End-to-end multiplayer acceptance on two actual phones (including reconnects, switching Wi-Fi/mobile networks and stale moves).
2. Production hardening: reliability under concurrency, longer-term persistence, abuse protection, accessibility and extra browser coverage.
3. Optional enhancements: animations, game history/rematches, more skillful AI, house-rule selectors, and room hosting refinements.


## Phase 11 (v1.1.0)
See [README_PHASE11.md](README_PHASE11.md) for the opt-in PostgreSQL durable-room backend, concurrency safeguards, deployment conditions and real-phone acceptance checklist. The existing Render service is **memory-only until DATABASE_URL is configured**; no new database has been provisioned.

## Phase 18 audio

See [README_PHASE18.md](README_PHASE18.md) for the sound bank, Sonilo/Mirelo production provenance and provider-asset import status.
