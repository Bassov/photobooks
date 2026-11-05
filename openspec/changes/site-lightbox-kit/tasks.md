## Implementation

- [x] 1. `uikit/src/features/lightbox-zoom.ts`: kit copy of the pager zoom model
- [x] 2. `Fullscreen` layout and look (roadmap scope bullet 1) — kit qa "Close X does not overlap", fit check; DOM numbers below
- [x] 3. `Fullscreen` input and transform-only zoom, `data-zoom`, `initialZoom` (roadmap scope bullets 2–3) — kit qa double-click / ArrowRight / Esc checks
- [x] 4. `SiteViewer`: `SiteState.lbZoom` → `initialZoom`; lightbox render with `--shadow-stage-dark` — `#/feature/site-lightbox` "Zoomed 2×" → `data-zoom` 2.00
- [x] 5. `pages.tsx` `site-lightbox`: "zoomed" state, two edge lines
- [x] 6. `qa.mjs`: lightbox tab ring list + 4 new checks — `pnpm uikit:qa:quick` 392 PASS / 0 FAIL

## Manual test scenarios

1. Kit `#/feature/site-lightbox` at 1440×900: spread rect, X / Zoom / arrow rects, indicator, 3 slides mounted, step transition 200 ms.
2. Double-click, Ctrl+wheel, drag pan: only the zoom layer's `transform` changes; Esc closes at z 2; ArrowRight resets to 1.
3. `hover: none` + touch 390×844: no arrows, side inset 8; reduced motion: no transition.
4. Re-baseline `#/demo` step `site-fullscreen` into `.cache/agent` (evidence).
