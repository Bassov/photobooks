# page-count-mismatch

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item page-count-mismatch
Status: done

## Scope

- [ ] One printed page count (`pagesOf` in `src/core/pages.ts`: page 1 + 2 per inner spread + a single last page, the sum of `getSpreadPageCount`) feeds the editor top bar, Book settings Pages box / note / stepper, the library tile caption + aria-label, the spine width and the site / static export meta (Designer 2026-11-04 16:07, #464 review: "6 pages" for a book listing pages 1–4).
- [ ] The Pages stepper adds or removes spreads until that count equals the typed value, so for each preset page count the stepper value equals the pages listed in the Spreads panel.
- [ ] Tests: unit test for the count (cover-less book, 1 single + N doubles, last single) and an e2e that the top bar, Book settings and the page list agree for the 4-page fixture book (DOM text + bounding box > 0).
- **Browser check:** fixture book with pages 1–4: top bar "· 4 pages", Book settings Pages "4"; type 20 → the list ends at page 20.
- **Kit components:** `uikit#/demo` top bar / Book settings / spread list (reference: kit `pagesOf(n)` counts kit spreads plus its separate last page; no kit edits).
- **Hard nos:** no kit edits; no visible change beyond the number; off limits `src/render/SpreadView.*`, `src/editor/frame*.ts`, `src/core/geometry/resolveSpread.ts`, `src/core/ops/frames.ts`.
- **Test:** unit + PBT (count / stepper) + Playwright e2e (DOM text and box).
