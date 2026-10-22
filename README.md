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


**Ten playable original card and tile variants.** This is a phone-first private games-night collection, with 16 selectable portrait avatars, a gold-and-teal lounge, bot opponents, optional card sounds and private server-authoritative two-player rooms.

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
