## Decisions

1. **Page → spread.** Physical page `p` (1-based, as `folioText`): spread `⌊p/2⌋`, even `p` = left. A two-page spread's right page is offset by the trim width; single first / last pages start at x 0; unknown pages throw. `resolveSpread` gives the items; paint order is `SpreadView`'s (page colour → parent items → folios → spread items by `z`), clipped to the page.
2. **Reuse values, not math.** Rects from `frameBox`, image geometry from `turnedPhotoStyle`, rings / radius from `frameStyleCss`, filter from `adjustFilter`, font / line height / whole-lines height from `textNodeStyle`; CSS-only values of `SpreadView` (caption, folio) are constants with a comment.
3. **Line breaking.** `textStyles.ts` has none and is outside the lane, so `breakTextLines` (CSS `pre-wrap` + `overflow-wrap: anywhere`) lives in `pagePainter.ts`.
4. **Worker-capable.** Only the ctx API plus `FontFaceSet.load(font, pageText)` for each `textStyleFonts()` entry on `document.fonts` or worker `self.fonts` (skipped when absent); no DOM, so the consumer can paint in a worker.
5. **e2e harness.** The painter is not in the app bundle, so the spec builds a test-only IIFE (never shipped; no security surface) with Vite `build()` — React, `SpreadView`, painter, `makeBook` — and injects it with its CSS on `/`.

## Touch-set & Test Plan

| Path                             | Why                        |
| -------------------------------- | -------------------------- |
| `src/render/pagePainter.ts`      | painter + `breakTextLines` |
| `src/render/pagePainter.test.ts` | unit                       |
| `e2e/page-painter.spec.ts`       | parity e2e                 |

- Unit (recording ctx): page offset / clip, order, crop + turn, rings, filter, text lines, caption ellipsis, folio align, missing image, unknown page, `breakTextLines`.
- e2e: 4 fixtures, ΔE outside text, DOM line boxes = painter lines, no long task > 50 ms at 2×.
