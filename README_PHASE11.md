# STACKHOUSE SOCIAL — Phase 11: Reliability and room recovery

Version 1.1.0 · 22 October 2026

## Improvements

- Every create, join and move is processed serially. Two requests with an identical room revision cannot both change the table.
- All mutations roll back in memory if the persistent write fails. Clients do not receive a successful move or score for a failed write.
- Optional PostgreSQL snapshots (`DATABASE_URL`) retain hidden card state, seats, hashed session tokens, idempotency receipts, tournament results and mutual-rematch approvals across service restarts.
- PostgreSQL uses an atomic generation check to detect a stale second server instance, rather than overwriting another process's saved room data.
- The `/health` endpoint reports the configured storage mode and whether PostgreSQL durability is enabled, without revealing credentials.
- The waiting lobby warns players if tables are memory-only or depend on unverified filesystem storage.
- Additional automated tests cover overlapping moves, lost database writes, lost acknowledgements, restart recovery and concurrent database writers.

## Enabling genuine restart recovery on Render

Phase 11 does **not** provision a database or incur a new bill. To activate PostgreSQL persistence:

1. Provision a PostgreSQL database (confirm the cost and retention policy first). Use a private internal connection URL when Render offers it.
2. In the `STACKHOUSE` Render web service, add secret environment variable `DATABASE_URL` containing that database connection URL. Do **not** commit the value to GitHub.
3. Remove `ROOM_DATA_FILE` if present. The app rejects ambiguous dual-store configuration.
4. Redeploy and verify `/health` reports `storage: postgres` and `durableStorage: true`.
5. Create a private two-person game, make a move, record both players' saved seat tokens on their own devices, restart the service, and confirm both devices restore their separate hands, score and next turn.

The PostgreSQL `pg` package is installed on Render during deployment through `package.json`. Existing memory-only operation needs no database. The local development/test environment does not require a PostgreSQL connection. **Database integration is unit-tested with a simulated adapter; a real PostgreSQL failover test remains outstanding until a database is connected.**

**Architecture limits:** Exactly one live application instance is supported for game updates and SSE/presence. Generation checks prevent silent overwrites but do not synchronise multiple instances. No public matchmaking, player accounts or global leaderboards are added.

## Acceptance checklist (physical devices)

1. Start a Games Night Mix with two phones in separate networks; verify invite code, avatars and private hands.
2. Draw/play/discard on alternating phones; every move must appear once and only once.
3. Disable Wi-Fi on one phone, reconnect over mobile data, and check that the same turn and hand return without duplicate moves.
4. Refresh both phones independently, confirm the right player seat and score persist.
5. Finish a match, ask for rematch on one phone, cancel the vote, then mutually approve; the next game and running scoreboard should match on both devices.
6. With PostgreSQL activated, restart Render during a match and confirm full round/score recovery. Without PostgreSQL this test will intentionally fail and must not be marked passed.
7. Repeat with iOS Safari and Android Chrome and review accessibility, colour contrasts, card spacing and reduced motion.

Run `npm test` and `npm run build` for the code checks.
