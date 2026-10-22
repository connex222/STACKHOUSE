# Phase 18 — Audio Design

Stackhouse now has nine short, independent sample-based sound cues and a shared player in `src/audio.js`. The game honours the sound toggle, caps playback gain, rate-limits frequently triggered cues, and falls back to the previous gentle procedural audio on browser decode/playback failure. Ambience remains a separate opt-in toggle.

## Providers and provenance

- **Mirelo** produced new close-miked card contact, tile contact and victory sounds (generation IDs `8b79d85418fdc31fea3a12ca2740b2bb`, `f54aadde62d46f2a67dc583c10cf4c27`, `75716b8e8894d6c83e11235a3f671c5d`).
- **Sonilo** produced an eight-second luxury tabletop Foley collection and an eight-second UI/reward effects collection (task IDs `7a692efa-d14e-42a8-9d3f-191b105d29ef`, `c5fc7d62-e5a2-4412-aec4-89f2a702e15e`).
- These provider links could not be downloaded inside the original coding container. The dedicated GitHub Actions import workflow fetches all five completed master files into `assets/audio/masters`, validates them, converts the three Mirelo sounds into playable cues and commits them back to the repository. This must succeed before describing the provider audio as integrated into the live game.
- Locally generated non-provider audio is bundled now as a portable fallback for the nine cue slots, so the app works even if the import workflow cannot fetch a recording.
- Sonilo's longer masters are preserved for editorial audition rather than blindly splitting arbitrary timestamps into individual effects.

## To verify

1. Confirm the **Import Sonilo and Mirelo produced audio** action succeeds after the Phase 18 commit.
2. Check `assets/audio/masters` contains five files, and compare each rendered cue at normal volume on physical devices.
3. Use the header speaker switch to opt into cues; verify mute stops audio and ambience can be toggled independently.
4. Confirm autoplay is blocked until the player interacts and no event can flood the sound engine.
5. Check the portable `PLAY-OFFLINE.html` includes sounds and runs without networking.
