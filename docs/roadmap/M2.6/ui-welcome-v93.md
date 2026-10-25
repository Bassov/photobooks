# ui-welcome-v93

Tag: feature
Milestone: M2.6
Title: Port Welcome / first-run from kit v0.9.3

## Scope

- [x] Port Welcome / first-run chrome from kit into the product (copy JSX into `src/`; never import `uikit/src`)
- [x] Keep working Create Library → File System Access folder picker → empty library handoff
- [x] Retire old `pb-screen` / placeholder Welcome; kit copy and layout win
- **UI kit:** `uikit/src/features/library.tsx` (`WelcomeScreen` / `FirstRun`), `uikit/src/features/screen-demos.tsx` (`first-run`), `UI ref: uikit#/screen/first-run`, `UI ref: uikit#/demo` (welcome stage)
- **Browser check:** On a Chromium preview, first run shows kit Welcome; Create Library opens the directory picker; cancel returns to Welcome; success lands on empty library
- **Perf:** Welcome mount stays under frame-budget idle; no LoAF on the Create Library click path (p95 handler ≤ 2 ms before picker)
- **Size:** ~600–1000 changed lines; prefer ≤1500
- **Source:** Owner package D
