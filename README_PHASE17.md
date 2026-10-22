# Phase 17 — Accessibility and release readiness (v1.7.0)

Release scope: 22 October 2026. This phase maintains the feature freeze and does not change any game mechanics, opponents or card inventory.

## Improvements

- **Skip-navigation link:** The first keyboard focus stop, when tabbing into the application, is “Skip to main content”. Enter focuses the active main region. The link becomes clearly visible when focused, and is included in online and offline versions.
- **Single stable main landmark:** Home, room and all game views provide the same target (`#main-content`) with `tabindex="-1"`. This remains usable across the app's rendering system.
- **Expanded browser checks:** Automated Chromium coverage now exercises all ten bot games at 320px and 390px CSS viewports with WCAG text-spacing overrides (line height, letter spacing, word spacing and paragraph spacing). Tests reject document-level horizontal scrolling, obvious clipped controls and uncaught JavaScript exceptions.
- **CI:** The `Accessibility keyboard smoke` workflow runs the previous focus/dialogue tests and the new reflow suite on commits and pull requests.

## Verification

```sh
npm test
npm run build
python scripts/accessibility-smoke.py
python scripts/reflow-smoke.py
```

**Scope and limitations:** The two viewport widths approximate reflow at 400% from a 1280px display; this is **not a true native browser zoom test**. The script does not determine colour contrast accurately for the image-backed/gradient interface and does not reproduce screen-reader speech. A final accessibility conformance decision requires contrast sampling across states, native zoom, NVDA/VoiceOver/TalkBack testing, and actual device testing. No WCAG 2.2 AA conformance claim is made.

**Unchanged release conditions:** Eight games support 2–6 private online players, while Number Ladder and Low Glow remain two-player. Real physical-phone acceptance is incomplete. The Render service has no configured persistent PostgreSQL database; active rooms can be lost after a restart. No paid services have been provisioned by this phase.
