# pasteboard-workspace

Tag: feature
Milestone: M1
Title: spreads on a pasteboard

## Scope

- [x] Pasteboard: all spreads stacked vertically, off-screen spreads virtualized, active spread follows scroll
- **Perf:** `contain` + `content-visibility` per spread, active-spread tracking via `IntersectionObserver` (no scroll-handler layout reads). Gate: fixture book (~40 spreads × 4 photos), scroll top to bottom — zero LoAF, frame pacing within budget; if it fails, stop and re-plan per "Painter risk" in `docs/future-architecture.md`.
- **Browser check:** scroll through the fixture book like an InDesign pasteboard — no dropped frames; document does not grow H/V scrollbars; pasteboard is the vertical scrollport.
- **UI ref:** `uikit#/feature/pasteboard-workspace`
