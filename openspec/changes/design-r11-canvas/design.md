## Decisions

1. M73: `SpreadView` paints the canvas page cut as `.spread-fold` (same `spread-page-cut` test id): `left` at the cut, `width: 3%`, full height, `translate: -50%`, kit gradient. No `data-camera-frame`, so it scales in the same transform as the page (no lag, nothing added to the zoom rAF). The gradient rides a custom property so the minifier keeps `to right`. Thumbs keep the 1 px hairline (kit `MiniSpread`).
2. M74: new token `--cover-shadow-mini` (kit `shadowSm`) on `.cover-spread[data-mini]` / `.endpaper-spread[data-mini]`; `EndpaperCanvas` gets `data-mini` like `CoverCanvas`.
3. M75: cover text sizes are `calc(100cqw * px / 848)` with the kit's 848 px Fit cover, so the ratio holds at any size; weight 400. The kit ships upright Lora only (synthetic italic); the cover `em` reads a `Lora Cover` alias of the same upright woff2 files first, so its glyphs and width match the kit (the real italic face is 223 vs 228 px; `oblique` still picks it) while the global italic face stays. Labels use the kit `PageLabels` cell: panel-wide, centred, 10 px gap; an overflowing label (Spine) starts at the panel edge.

## Touch-set & Test Plan

- Files: `src/render/SpreadView.{tsx,css}`, `src/editor/CoverCanvas.css`, `src/editor/EndpaperCanvas.{tsx,css}`, `styles/tokens.css`, `docs/design.md`, `e2e/design-r11-canvas.spec.ts`, `e2e/design-r7-canvas-chrome.spec.ts` (Owner design change, round 11, M73: fold width 3 % of the spread every frame).
- Reuse: `pageCutLine`, cover cqw container, `chooseZoom`, `openLibraryBook`.
- Tests: unit `SpreadView.test.tsx` (fold vs thumb hairline, both orientations), `bookLookUi.test.tsx` (endpaper `data-mini`); e2e new spec (Fit, 200 %, cover at Fit and a 2× cover); r7 M51 wheel / ctrl-wheel frames.
