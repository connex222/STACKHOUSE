# Stackhouse Social — Phase 15 Release Audit

Version **1.5.0** — 22 October 2026

## Release scope

This is a hardening and usability release, **not** a new game, ruleset or player-count expansion. The ten game modes, original artwork, 16 avatars, optional sounds, solo bots and private room formats are preserved.

- **Request safety:** HTTP JSON body limit now measures **bytes** (8 KiB), even for multibyte characters. `null` and array room/join payloads produce clear 400 responses instead of exposing internal errors.
- **Live event streams:** No more than three simultaneous SSE connections per authenticated player seat. Additional attempts receive HTTP 429 without affecting other seats; reconnecting after a disconnection is permitted.
- **Security headers:** API, live streams and static pages include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and a restricted `Permissions-Policy`. The existing Content Security Policy remains in place on game pages. Health endpoint accepts GET/HEAD only.
- **Mobile and accessibility:** Minimum 44-pixel controls for key lobby, sorting and room actions, stronger keyboard-focus outlines, narrow-viewport group seat layout and reduced-motion-friendly scroll/hover effects.
- **New automated audit tests:** UTF-8 oversized input, invalid payloads, protection of server-side modules, security headers, event-stream capacity and cleanup.

## Verified checks

Use `npm test` for all deterministic engines, multiplayer rooms, network HTTP/SSE tests, reconnection, saved-room simulations and release security tests. Use `npm run build` for the production static and self-contained offline packages. The `/health` endpoint explicitly reports `durableStorage:false` without a connected PostgreSQL database.

The project contains a browser interaction script at `scripts/browser-acceptance.py`, but it requires an environment permitting Chromium access to the local game server. Do not treat this as a passed browser/device test without successful execution.

## Outstanding launch blockers

1. **Real-device acceptance:** Verify Android and iPhone join, play, leave/rejoin, host-start, six-seat layout and end-of-match rematch with independent physical devices. Full multi-browser and screen-reader acceptance are also unverified.
2. **Permanent multiplayer storage:** The current Render instance is **memory-only**. PostgreSQL support exists but no database is connected, so rooms and tournament scores can disappear on server restart. Enabling storage may incur charges.
3. **Independent game-rules review:** The ten games are original simplified house-rule variants; an editorial/playtesting review of all rules and game balance is still advisable before a wider launch.

**Current scope:** 8 of 10 games support private 2–6-player tables. Number Ladder and Low Glow remain two-player. Games Night Mix remains two-player. Do not describe every game or the mixed tournament as supporting six players.

**Deployment:** Render is linked to the GitHub `main` branch with auto-deploy. Confirm the actual commit SHA, CI run and Render `live` status for this release rather than inferring success from a successful local build.
