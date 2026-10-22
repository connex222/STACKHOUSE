# STACKHOUSE SOCIAL — Phase 4: Ten Tables

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
npm test             # Phase 4: 62 automated tests
npm run build        # Assemble static dist/ (no multiplayer backend by itself)
npm run build:offline  # Recreate self-contained PLAY-OFFLINE.html
```

Tests cover core game legality, card inventory, deterministic bots, secure room projections, turn/revision validation, API and SSE flows, plus a DOM smoke harness and offline bundle execution. The latest builds were also opened in desktop and phone-sized Chromium views; the new Tile Royale and Low Glow layouts and ten-game lobby were inspected. This is **not** a full real-world two-phone acceptance test, multi-browser audit or production load test.

## Hosting notes

The provided `render.yaml` specifies a **Node web service**, not a static website. To publish live multiplayer, put this project in its own GitHub repository and configure Render to build with `npm run build` and start with `npm start`. The `/health` route returns application status. For persistence through server restarts, configure a protected storage volume and `ROOM_DATA_FILE`, or migrate to a managed database. This server is designed for a **single Node process** with private two-player rooms, not public matchmaking or large-scale production traffic. Rotate/restrict infrastructure credentials appropriately and review hosting costs.

**Current deployment status:** The files are packaged locally. This Phase 4 build has **not** been pushed to GitHub or deployed to Render. A dedicated Stackhouse Social repository has not been verified.

## Outstanding development work

1. End-to-end multiplayer acceptance on two actual phones (including reconnects, switching Wi-Fi/mobile networks and stale moves).
2. Production hardening: reliability under concurrency, longer-term persistence, abuse protection, accessibility and extra browser coverage.
3. Optional enhancements: animations, game history/rematches, more skillful AI, house-rule selectors, and room hosting refinements.
