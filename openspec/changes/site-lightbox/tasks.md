## Implementation

- [x] 1. `SpreadPager` `variant` / `ariaLabel` / `testId` / `onZoomSettle`; presentation moved verbatim (`src/render/SpreadPager.test.tsx` existing block unchanged, green).
- [x] 2. `LightboxPager` + `useLightboxZoom`: fit insets, chips, arrows, keys, zoom / pan / pinch / swipe, transform-only layer (`src/render/LightboxPager.test.tsx`).
- [x] 3. `SiteLightbox`, `SlideContent` export with `sizesPx`, `site-open` overlay, Fullscreen button, `.site-actions`, glyphs (`src/site/SiteBookPage.test.tsx` fullscreen block).
- [x] 4. Unit tests: pager lightbox block, hook gestures, book page open / close / sizes; snapshot update.
- [x] 5. `e2e/site-lightbox.spec.ts` incl. the CPU ×4 perf scenario (10 / 10 local).

## Manual test scenarios

1. `site.html?book=alps` at 1440×900: Fullscreen opens on the current slide, arrows / Home / End step, double-click zooms 2×, drag pans, Esc closes on the lightbox's slide with focus on the opener.
2. 390×844 touch: tap the stage opens, no arrows, swipe steps.

manual-qa (stage 9): harness problem, not a product verdict: `pnpm agent manual-qa` waits for the editor welcome screen (`start-session` click intercepted by its header) and never reaches `site.html`. Both scenarios are covered by `e2e/site-lightbox.spec.ts` (10 / 10 local: open by button / stage, keys, 120 px swipe, Esc + focus, double-click anchor, pan clamp, 390×844 touch, reduced motion, CPU ×4 perf gate).
