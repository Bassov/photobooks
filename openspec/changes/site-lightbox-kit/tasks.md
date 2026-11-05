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

- harness problem: `pnpm agent manual-qa` drives prod only (waits for `editor-shell`); kit-only item, so scenarios ran as a Playwright DOM walk over `uikit/dist` (`#/full/site-lightbox`, dialog 1440×900) plus kit qa.
- OK 1: spread 1301.91 × 788 at x 69.03, y 64; X 32 at 16/16; Zoom 32 at right 56; arrows 40 at left / right 12, top 438; Previous `visibility: hidden` on the cover; indicator bottom 16, 12/16 white/.6; bg rgb(13 13 13); chips white/.1; shadow 0 20px 60px rgb(0 0 0/.6); dialog focused; Tab Previous → Next → Zoom → Close → Previous; slides i ± 1 mounted inert at opacity 0, `transition 0.2s transform, opacity`.
- OK 2: double-click → `data-zoom` 2.00, slide left / top / width / height unchanged, clicked point fixed (0.3000 → 0.2999); drag pans the layer; Ctrl+wheel −100 → 2.72; ArrowRight while zoomed → 1.00; Esc at 2.00 closes in one press (kit qa).
- OK 3: `hover: none` touch context: no arrows, slide side inset 8; reduced motion: slide transition none.
- OK 4: `demo:baseline` 76 steps → `.cache/agent/demo-baseline/60-site-fullscreen.png` (walk unchanged).
- ui-review: no findings (tokens `bg-presentation`, `shadow-stage-dark`; focus-visible 2px white; labels on every control; reduced motion respected; no empty state / scrollport).
