# e2e-paint-probe

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item e2e-paint-probe
Status: done

## Scope

- [x] New `e2e/fixtures/paintProbe.ts` (≤40 lines, no new deps): `topAt(locator, point?)` returns the `elementsFromPoint` stack with pointer-events:none layers (the grid SVG) hit-tested too; `pixelsAt(locator, points | outside)` decodes a clipped screenshot in the page (createImageBitmap + canvas) and returns RGBA at the points, or the share of non-background pixels in the box outside a child (process item P-20261105-0150-1).
- [x] The ad-hoc probes in `e2e/kit10-cover.spec.ts`, `e2e/design-frame-crop-masters.spec.ts` and `e2e/presentation-mode.spec.ts` use the fixture (their copies removed).
- [x] `e2e/layout-grids-parent-inherit.spec.ts`: on a two-page spread whose frames cover both pages, Master A's grid paint shows on BOTH pages (pixels with the grid on differ from the grid off, including under the right page's frames).
- [x] `e2e/kit10-spread-list.spec.ts`: a two-page row paints nothing inside `.editor-spread-thumb` outside the paper rect beyond the shadow blur.
- [x] `docs/agent-loop.md` testing line: visual Done-when / bug → assert paint with `e2e/fixtures/paintProbe.ts`, not only DOM presence.
- **Done when:** with the master-spread overlay z-fix locally reverted the grid assertion fails on page 3 and passes with the fix (both runs in the PR, revert not committed); the three migrated specs stay green; `pnpm test:e2e:changed:quiet` green; fixture ≤0.5 s per call (measured, in the PR); net e2e lines remove the three probe copies (≥15 lines).
- **Browser check:** N/A (tests + docs only, no `src/` or `uikit/` change).
- **Hard nos:** no product code change; no new dependency; no edits to `e2e/parent-overrides.spec.ts`, `e2e/parent-spreads.spec.ts`, `e2e/kit-frame-keys.spec.ts` or page-count specs.
- **Test:** Playwright e2e only.
