# site-lightbox-zoom-core

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item site-lightbox-zoom-core
Status: done

## Scope

- [x] New pure model `src/render/pagerZoom.ts` (Designer `site-lightbox` spec §2 fit area, §3 zoom/pan rules, §4): `Zoom = {z, x, y}`, `ZOOM_MAX = 3`, `ZOOM_STEP = 1.5`, `ZOOM_TOGGLE = 2`, `ZOOM_SNAP = 1.02`, `FIT_INSETS = {top 64, bottom 48, side 64, sideTouch 8}`; `fitBox`, `clampPan`, `zoomAt` (anchor at the pointer, z clamped to [1, 3]), `wheelFactor(deltaY, deltaMode)`, `settle` (snap below 1.02 to 1).
- [x] Unit tests `src/render/pagerZoom.test.ts` and property tests `src/render/pagerZoom.pbt.test.ts`.
- **Done when:** unit: `fitBox` gives Alps 1301.91 × 788 at 69.04, 64 and Sea 1312 × 492 at 64, 212 for view 1440 × 900, and 374 × 226.36 at 390 × 844 with sideTouch (±0.01); PBT: z ∈ [1, 3]; z = 1 ⇒ x = y = 0; `clampPan` idempotent; unclamped `zoomAt` keeps the anchor point (≤ 0.01 px); `zoomAt(zoomAt(s, f, p), 1/f, p)` = s when unclamped; `pnpm test` green for the new files; stryker-diff on `pagerZoom.ts` not below the repo threshold.
- **Browser check:** N/A (pure model, no UI; item `site-lightbox` wires it into `SpreadPager`).
- **Perf:** N/A (pure arithmetic, no handlers wired yet).
- **Off limits:** `src/render/SpreadPager.*`, `src/site/**`, `uikit/`, `src/render/SpreadView.*`, `src/core/**`, `src/derivatives/`.
