# ui-unsupported-v93

Tag: feature
Milestone: M2.6
Title: Port unsupported-browser screen from kit v0.9.3

## Scope

- [ ] Port unsupported-browser screen from kit; show it when File System Access is unavailable (feature detect, not UA alone)
- [ ] Kit copy and CTAs win (Get Chrome / other Chromium links / Copy link); no “continue anyway”
- [ ] Retire any interim unsupported placeholder
- **UI kit:** `uikit/src/features/screen-demos.tsx` (`unsupported-browser`), `UI ref: uikit#/screen/unsupported-browser`
- **Browser check:** With FSA unavailable (or a test hook), the unsupported screen matches kit; supported Chromium still boots Welcome/library
- **Perf:** Gate runs before IndexedDB / permission prompts; no half-created library state
- **Size:** ~300–600 changed lines
- **Source:** Owner package E
