## Decisions

1. The kit cannot import `src/`, so `uikit/src/features/lightbox-zoom.ts` mirrors `src/render/pagerZoom.ts` (same functions and constants).
2. Slides i ± 1 are mounted at the fitted rect, keyed by index, inert at opacity 0; the step is their `translateX` + opacity transition.
3. Zoom is stored per slide index: on a step only the old slide's entry is kept, so it slides away at its zoom and the new one opens at 1. Zoom is transform-only on a layer around the fitted box; displayed zoom is re-clamped against the current box.
4. The dark page shadow is drawn by the caller's `render` (SiteViewer's stage shadow span with `--shadow-stage-dark`), so `site-photographer` is unchanged.
5. Tokens (`docs/design.md` Presentation overlay): kit `--presentation` (`bg-presentation`) and `--shadow-stage-dark`; the kit lacks `--presentation-chip*`, so chips use the same values as Tailwind `white/10`, `white/20`. No new tokens.

## Touch-set & Test Plan

| File                                   | Why                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `uikit/src/features/lightbox-zoom.ts`  | new: pure zoom / fit math                                                  |
| `uikit/src/features/site-viewer.tsx`   | `Fullscreen` rewrite, `SiteState.lbZoom`, lightbox render with dark shadow |
| `uikit/src/features/pages.tsx`         | `site-lightbox` "zoomed" state + edge lines                                |
| `uikit/scripts/qa.mjs`                 | tab ring list + 4 new lightbox checks                                      |
| `docs/roadmap/P3/site-lightbox-kit.md` | stub item filled from the brief                                            |

- Reuse: `slideLabel`, the stage shadow span; `site-photographer` call site unchanged.
- Tests: kit qa (`pnpm uikit:qa:quick`) locks the observables; DOM measurements (incl. `hover: none`) go in Manual test scenarios.
