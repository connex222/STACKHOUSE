# Phase 16 — Rules and Accessibility Corrections (v1.6.0)

Release date: 22 October 2026. This is a focused follow-up to the independent rules and accessibility review.

## Rules: depleted-deck sequencing

**Confirmed issue:** Malice Duel could reach a turn with no cards in hand, no available draw cards and no legal stock or personal-discard plays. Six-player seeded games could not advance.

**Implemented house-rule resolution** (Stack Run and Malice Duel):
1. If your hand is empty but completed building stacks have supplied a recyclable draw deck, choose **Refill empty hand**. This does not end your turn.
2. If the hand, draw and recyclable piles are all empty and you have no legal stockpile/discard play, choose **Pass — no legal moves**. The server verifies every condition; players cannot voluntarily skip a playable turn.
3. If each player is forced to pass consecutively without any intervening card play or discard, the game ends in an **exhausted-deck showdown**. Fewest cards remaining in the personal stockpile wins; ties for the fewest cards are draws.
4. Any valid card play or hand discard resets the pass counter. This is a deterministic original house rule, not a claim about commercial Skip-Bo or Spite & Malice rules.

This also works for room sessions, private opponents, saved server games, solo bots and match-series draw accounting. A six-player, 250-seed computer simulation found every match resolved (victory or draw), preserving all original cards. This sample cannot prove that every possible player strategy terminates.

## Keyboard and accessibility

- Avatar and rules dialogues send focus inside when opened, trap Tab/Shift+Tab inside, make the page behind inert, close with Escape, and return focus to the exact triggering button.
- The UI keeps focused cards/tiles/controls across rerenders by stable card identity and button attributes, including in the tap-to-select card flow.
- The app-wide `aria-live` attribute was replaced by a small, persistent `role=status` announcement element. Status text changes only when the announcement changes; the full page is not read on every rerender.
- Sequencing and contract card buttons have `aria-pressed` when selected; individual sequencing discard cards and selected eights do too. Tile selection already exposed this state.
- Introductory tiles disclose immediate contract-round endings, Shanghai's lack of discard buying and Tile Royale's lack of full table rearrangement. Contract penalty points are explicitly informational, not a match-winning tie-break.
- Further narrow-screen CSS rules reduce the chance of horizontal clipping; the current synthetic 320/390px Chromium check shows no document-level horizontal overflow.

## Verification and limits

Commands:

```bash
npm test
npm run build
python scripts/accessibility-smoke.py
```

The new test module verifies forced passes, server-authoritative legality, refill constraints, ties, resetting passes, isolated private hands and seeded group-match completion. The optional Playwright smoke script checks focus, inert modal background, keyboard cycling, Escape return, retained card focus, `aria-pressed` and 320/390px layout; a GitHub Actions workflow runs it on main and pull requests.

**Unverified:** Native 400% browser zoom, screen-reader output (NVDA, VoiceOver, TalkBack), image-backed contrast, real physical phones, and actual cross-browser keyboard/drag behaviour. No claim of WCAG 2.2 AA conformance is made. Render PostgreSQL storage remains unconfigured, and cloud restarts can still lose active rooms. The live release has not been accepted by a physical games-night test group.
