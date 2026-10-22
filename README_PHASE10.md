# STACKHOUSE SOCIAL — Phase 10: Games Night Mix

Version 1.0.0 · Private two-person games-night release

## The new feature: games across different tables

Private rooms offer two formats:

- **One game:** the existing first-to-three-wins series; consensual rematches replay the same game.
- **Games Night Mix:** the host chooses the first of ten games. After every completed match, both players must request a rematch to advance to the *next different game*. The room code, player seats and scores remain unchanged. Three match wins crown the champion. Draws count towards the match history without awarding a win. Following a champion, both players can agree to a fresh series, starting again with the host's original choice. If draws extend a series, the ten-game cycle repeats.

The server selects the next game and deals cards, prevents duplicate match scoring, and redacts opponents' private information. Both phones share one server-owned scoreboard and recent per-game results. A session can be resumed with the saved seat token while the room remains available.

## Solo opponents

The home page offers **Easy / Standard / Expert** for Stack Run, Malice Duel, Number Ladder and Eight Shift. Easy makes straightforward moves; Standard is the existing greedy bot; Expert uses alternative hand/planning scores on supported games. Expert is a heuristic, *not* a guaranteed winning AI and does not inspect hidden opponent hands. The other six games continue with their existing standard House Bot. Your setting remains in this device's browser storage.

## Validation

Run `npm test` and `npm run build`. Automated tests cover mixed tournament selection, score retention, consent, server reload using an explicitly configured storage file, private-hand masking, input validation, HTTP creation, and new bot difficulty settings. A standalone offline edition can be opened from `PLAY-OFFLINE.html` (bots only).

## Important live hosting limitation

Your current Render service has no verified persistent room storage. In-memory room sessions and scores disappear when the server restarts or is redeployed. The source supports atomic JSON snapshots by setting `ROOM_DATA_FILE` **to a genuinely durable filesystem**, but a path in an ephemeral Render container does not solve this. Configure a real persistent volume or database before promising restart recovery. This phase does **not** migrate storage to a managed database. Server capacity remains a single Node process with private two-person rooms; it is not public matchmaking or a public leaderboard.

Real physical-phone, network-switching, screen-reader and long-duration two-person acceptance tests still need to be performed. Automated API tests and simulated room clients are not substitutes for that work.
