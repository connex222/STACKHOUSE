# Stackhouse Social — Phase 12: multiplayer acceptance and storage readiness

Version 1.2.0 · 22 October 2026

## Completed

- **Ten-game HTTP integration:** two independent player credentials join each game, receive their own seat-specific state and never receive the other player's private hand or raw session token.
- **Live event-stream check:** a guest's authenticated event stream receives the updated game revision after the host moves, without showing the host's cards.
- **Network retry protection:** repeating an action ID does not apply the move twice; stale revisions return HTTP 409.
- **Restart rehearsal:** ten local games are saved into a temporary room-snapshot file; one active game restarts with the same move revision, private sessions and retry acknowledgement. This tests recovery logic, **not cloud disk durability**.
- **Truthful server health:** `/health` reports `storage`, `durableStorage`, and `databaseConnected`. A configured PostgreSQL URL only counts as durable when a live database ping succeeds. Failed pings produce HTTP 503. Filesystem storage remains `durableStorage: false` because this health endpoint cannot guarantee that Render will preserve the volume.
- **Safer file serving:** `/src/server/` is not served to browser clients.
- **Active-game persistence warning:** if a table lacks PostgreSQL-backed storage, the player sees a reminder during play, not just in the waiting lobby.
- **Optional Playwright two-mobile-context script** in `scripts/browser-acceptance.py`, which can be run locally against a server. It was not executable within the assistant's restricted browser environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). Browser and physical-device success are **not** claimed.

## Verification

```
npm test
npm run build
npm run test:network
```

## Cloud durability remains unactivated

Render `STACKHOUSE` currently has **no Render PostgreSQL database**. No paid database has been created or activated. The production game will lose in-memory rooms on service restart. To enable restart recovery, first approve a PostgreSQL service and its monthly price/retention terms; then securely set `DATABASE_URL` on the `STACKHOUSE` web service, redeploy and confirm the health endpoint returns `storage: postgres`, `durableStorage: true`, `databaseConnected: true`.

**Do not use `ROOM_DATA_FILE` on the service's ephemeral filesystem** as a substitute for a durable disk.

## Physical-device acceptance still required

Invite one iOS Safari player and one Android Chrome player from two different networks. Check room joining, both private hands, turn-by-turn moves, card and tile reordering, reconnection during a temporary outage, rematches and mixed-game series. With durable Postgres enabled, restart Render midgame and verify both seats restore. Until then, mark restart recovery as a local rehearsal only.
