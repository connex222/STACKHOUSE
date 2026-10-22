# Stackhouse Social — Release acceptance after Phase 15

**Scope:** Verification-only. No new game modes, changed house rules, or new hosting charges.

## What is now automated

- `npm test`: includes eight separate six-player private tables, seat-isolated card projections, full tables rejecting a seventh player, mutually-exclusive simultaneous revisions, duplicate move acknowledgements, six-player state restoration using a temporary snapshot file, and two-player-only mode restrictions.
- `npm run build`: produces a release and standalone offline build.
- GitHub Actions: the existing Node suite plus an **emulated mobile browser** job using independent Chromium contexts at 375, 390 and 412 px, checking head-to-head joins, opponent live updates, refresh recovery, a four-player contract table, horizontal overflow, and JavaScript errors.
- `STACKHOUSE_URL=http://127.0.0.1:4173 python scripts/browser-acceptance.py`: runs the same browser checks on a machine with Playwright Chromium installed and a locally running server.

## Release gates not waived

- These automated mobile contexts **are not physical phones**. Real iPhone/Android, mobile Safari and mobile Chrome sessions must still be tested. A practical manual test is: host a four- or six-seat room, join from distinct handsets, play legal moves, switch networks on one phone, rejoin, and agree a rematch.
- The production Render service is currently **memory-only**, with no PostgreSQL instance connected. File-backed local tests do not prove durability across a Render restart. Enabling a database could incur a charge and requires a separate decision.
- Obtain an independent review of the simplified house rules and a screen-reader/accessibility pass before claiming a full public launch.
- The browser job is an additional release check and must itself be confirmed green in GitHub Actions. If the CI image cannot run Chromium, that is an unverified check, not a pass.
