# Adding a STACKHOUSE game module

This guide describes the internal game-module interface, not a plug-and-play third-party API.

1. Add a deterministic game engine under `src/engine/`. Its state must support a clearly defined current player, winning condition, and legal move validation. It must not read room credentials or issue HTTP requests.
2. Register the legacy-compatible mode string and engine family in `src/server/game-modules.js`, including a state factory in `factories`.
3. Implement the adapter's `create`, `viewForSeat`, `viewForTV`, `listLegalActions`, `applyAction`, `botMove`, `isFinished` and `scores`. `listLegalActions` exposes candidate action **types**, not guaranteed card selections: `applyAction` validates exact moves and returns the new state or an error.
4. Update `RoomStore`'s allowed mode list, compatible group modes and `securelyDeal` handling. The room service continues to authenticate players, reject stale revisions, implement idempotency, securely shuffle hidden card zones, and save state. Never expose `draw`, `seed`, private hands or authentication tokens in seat/TV projections.
5. Register the new mode in `src/ui/game-catalogue.js`, add its help text to `src/ui/game-instructions.js`, and connect the relevant screen in `src/main.js`; add public TV state to `src/tv.js`. If you add new `src/ui/` or planning modules, also add them **before their importers** in `scripts/build-offline.js` because the standalone edition concatenates source modules into one local script. Maintain offline mode compatibility.
6. Add deterministic game logic tests, action-authorisation tests, visibility/redaction tests, a six-player network test if relevant, and both online/offline build checks. Execute `npm test` and `npm run build`.

Existing six module families are `sequence`, `contract`, `rack`, `tiles`, `low`, `eights`. Their adapters are exported via `GAME_MODULES` and resolved by `getGameModule(mode)`. Family game variants retain their original mode IDs, avoiding destructive save migrations. Bot logic runs locally or server-side; browser clients never receive other players' hidden hands.
