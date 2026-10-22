# Phase 13 — Multiplayer and Gameplay Balance

Version **1.3.0** — 22 October 2026

## New genuine 3–6-player private tables

Group-compatible original variants: **Eight Shift, Stack Run, Malice Duel and Tile Royale**. Select **Play with friends**, choose a supported game, select the number of seats (2–6), and host the game. Each phone opens the same six-character invite code. The host may begin a group game at 3 or more occupied seats, or play begins automatically when the selected capacity is reached. Joining after launch is not available; an existing player may reconnect with their seat credential.

The server alone controls cards, draws, actions, turn sequence, final scores and rematches. All other participants' hands are redacted in the recipient's view. Every seat has a separate token; no player can act as another seat. Match-series wins are tallied for every participant; a rematch requires approval from every player in the room. Draws award no series point.

**Still 2-player:** Phase Quest, Contract Club, Crown Circuit, Number Ladder, Shanghai Nights and Low Glow. The mixed-ten-game tournament remains a 2-player-only feature. This is deliberate: these engines have contract-progress and shared scoring rules that cannot simply be made 6-player by changing the lobby count.

## Gameplay and bot balance improvements

- **Tile Royale**: corrected score-tie result after a fully stalled draw pile. Three bot difficulty levels, including a wider legal-meld search at Expert, without reading an opponent's rack.
- **Low Glow**: three bot difficulty levels. Expert favours revealed opportunities to clear a matching column without inspecting hidden grid values.
- **Eight Shift**: an exhausted, blocked draw pile can no longer trap a game forever. If everyone consecutively has no playable card and cannot draw, the server awards the win for the lowest hand score, or records a draw on a tie.
- **Gameplay compatibility**: existing solo bots and all ten two-player engines are retained.

## Verification and limitations

Run `npm test` for full automated testing and `npm run build` for packaged web and offline assets. Automated coverage includes groups of 3, 4 and 6, turn rotation, projection of private hands, host-only starts, concurrent action rejection, idempotency, all-seat rematch voting, saved room recovery, HTTP endpoints, authenticated event streams and bot fairness.

**Not yet verified on physical phones**: real-world usability and network quality. The Chromium test harness was prevented from opening localhost by its administrator restrictions; no graphical browser acceptance pass is claimed. Render PostgreSQL still needs separate configuration and possible charges; memory-only rooms are not durable across service restarts.

Hosted games can be played on different phones or households via the existing Node web service. This is *not* public matchmaking or an open lobby.
