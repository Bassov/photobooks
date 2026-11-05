## Decisions

1. `topAt(locator, point?)`: `elementsFromPoint` under a temporary `* { pointer-events: auto !important }` style; each stack entry lists the `data-testid`s of the hit and its ancestors (closest first), so callers assert with `includes` / `findIndex`.
2. `pixelsAt(locator, points)` → RGBA per point; `pixelsAt(locator, inner)` → share (0–1) of painted pixels in the box outside `inner` plus the shadow blur. One clipped screenshot, decoded in the page (`createImageBitmap` + `OffscreenCanvas`).
3. Grid: on `painter-spread-1` (4-grid frames z 0–3 on both pages) the grid-on pixel differs from grid-off at one point per page (off/on/off, off reads stable). Reverting the overlay `zIndex` makes page 3 fail.
4. Spread-list: session book row 2 (pages 2–3), `pixelsAt(box, paper)` is 0.

## Touch-set & Test Plan

| File                                      | Why          |
| ----------------------------------------- | ------------ |
| `e2e/fixtures/paintProbe.ts`              | new fixture  |
| `e2e/kit10-cover.spec.ts`                 | → `topAt`    |
| `e2e/design-frame-crop-masters.spec.ts`   | → `topAt`    |
| `e2e/presentation-mode.spec.ts`           | → `topAt`    |
| `e2e/layout-grids-parent-inherit.spec.ts` | grid paint   |
| `e2e/kit10-spread-list.spec.ts`           | thumb paint  |
| `docs/agent-loop.md`                      | testing line |
| `docs/roadmap/P5/e2e-paint-probe.md`      | item (stub)  |

- Reuse: Playwright `screenshot({ clip })`, `openSessionEditor`; no new deps.
- Tests: e2e only; the z-revert run stays local.
