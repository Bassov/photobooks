# cover-empty-cloth

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item cover-empty-cloth
Status: done

## Scope

Polish item 5 of the Designer walkthrough-polish review (Owner Q-21, 2026-11-20): proposal P1 (empty cover = cloth,
everywhere) and the library-card half of P5 (book shadows). Today the empty front is drawn three ways: library card
#E8E8E8, editor front and mini covers #8E8E8E, site dark cloth.

- [ ] Prod: a front without a photo paints `cover.style.backFill` in the library card, the spread-list Cover row, the
      editor front (CoverView sheet + front) and mini covers; the title uses the book's Title font everywhere and the
      empty-front ink follows D38 (relative luminance < 0.23 → #F5F5F5, else #2E2C2D).
- [ ] Prod: the editor empty front shows, only on hover / drag-over, a 4 px-radius drop box inset 44/14/14/14 px of
      the front panel, bg rgb(255 255 255/.08), inset ring 1px rgb(255 255 255/.35), text "Drop a photo for the
      front" 11/14 rgb(245 245 245/.85); at rest no box.
- [ ] Prod: library book cards take `var(--shadow-book)` / `var(--shadow-book-hover)`, no scaled blur values.
- [ ] Kit: `uikit/src/sandbox/v7.tsx` empty front = cloth + drop box; kit library book shadow = the same tokens.
- [ ] Tests: unit for the ink rule, summary fields and the painter; e2e paint checks of the empty cover centre.
- **Browser check:** a new book with no cover photo: library card, Cover row and editor front read as the back cloth
  with the title in Lora italic; hovering the editor front shows the drop box.

## Done when

- Empty cover in the library card, spread-list Cover row and editor front paints backFill (pixels of a clipped
  `locator.screenshot()` at the cover centre = backFill ±2) and the title uses the Title font with D38 ink; the
  editor drop box appears only on hover / drag-over with the Spec numbers (computed style).
- Library cards' box-shadow references the shadow-book tokens. Kit v7 empty front matches. `pnpm roadmap check` green.
- Not touched: tokens (`--cover-empty` definitions stay), src/site/**, src/core/**.
