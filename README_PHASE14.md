# Stackhouse Social — Phase 14: The Group Lounge

Version **1.4.0** — 22 October 2026

## Eight private group games (3–6 seats)

**New group modes:** Phase Quest, Contract Club, Crown Circuit and Shanghai Nights. They join the four previously implemented group modes: Eight Shift, Stack Run, Malice Duel and Tile Royale.

**Two-player only:** Number Ladder and Low Glow, whose game engines require separate multiplayer adaptations. Games Night Mix still runs with two players. The House Bot modes, original assets and 16 avatars remain available.

The host chooses an eligible game and three to six seats. The game begins when all seats are filled, or the host can begin after three guests have joined. Players receive individual private hands and a shared server-authoritative turn sequence. Joins close when the match starts. The room code and session credentials allow reconnection. Every participant must approve a rematch.

## Group contract rules

- Players begin with 10 cards each, dealt privately. Rounds start with the next player clockwise, rotating across all participants.
- Each turn consists of one draw followed by either laying the complete contract or discarding one card.
- Only the player who lays advances their personal mission. All other players remain on their current mission and receive penalty points based on their own unplayed hands.
- The first player to complete their final mission wins. The existing first-to-three match-series ledger works for any number of seats.
- Five-suit Crown Circuit's wild rank still changes by round. The original house variants, not branded commercial games, remain unchanged in all other respects.
- Opponents' hands never leave the server; all group states have per-seat projections. Online moves require valid private session credentials and matching revisions.

## Group presentation improvements

- Responsive avatar seat rail: current-turn glow, seat connection information, personal card/tile count or contract score.
- Contract leaderboard shows each player's mission and penalty points on the desktop and phone layouts.
- Clear round-winner notification and next-round guidance; group win text names the actual player, not a generic opponent.
- Lobby descriptions identify the eight supported group games and explain why mixed tournaments remain two-player.

## Verification

Use `npm test` and `npm run build`. Phase 14 adds contract-engine tests at 3, 4 and 6 seats, end-of-round penalty tests, per-seat confidentiality checks, rematches and restart recovery, plus HTTP tests for all four new group titles with six authenticated clients.

**Not yet verified:** physical-phone browser testing. **Not configured:** paid PostgreSQL durability in Render; until this is enabled, active rooms may be lost during service restarts. Live deployment requires verifying the new GitHub commit and Render deploy.
