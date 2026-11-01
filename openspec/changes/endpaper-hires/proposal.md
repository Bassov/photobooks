## Proposal

Roadmap: `docs/roadmap/P1/endpaper-hires.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- `thumbCache.ts`, `thumbBackgroundWarm.ts`, `decodeScheduler.ts` (perf lane), PERF_BUDGETS, `#/demo`, `uikit/`.
- Spreads-panel cover/endpaper rows and inspector thumbnails stay thumb-only.

### Delta / Risk

- UI: endpaper canvas happy path (photo → `data-tier="1280"`), empty path (no photo → no `data-tier`, pattern) and the select-endpaper interaction are locked by the extended spread-view e2e plus unit tests.
- Painter fixture gains a cover and endpaper photo.
