# fill-book

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item fill-book

## Scope

Designer Spec fill-book FB3 (prod), item 3 of 3 (kit FB1 #700 and core FB2 merged). The prod filmstrip head gets the "Fill
book" chip first in its right group (`Fill book · Unplaced · Added order · Add folder…`; the three existing chips keep their x),
its confirm popover with the numbers from `planFillBook` on the live book, and a confirm that dispatches the core `fillBook` op.

- [ ] `src/editor/FillBookButton.tsx` (new): chip `film-fill-book` (look = Add folder…, lucide BookImage 14), disabled with a
      `title` reason (first match: no photos, Masters mode, every photo placed, every unplaced file missing), popover
      `fill-book-popover` (296 wide, padding 12, radius 8; rows `fill-book-order` / `fill-book-frames` / `fill-book-spreads` /
      `fill-book-pages`, missing note, `fill-book-left` warning, cover note, `fill-book-cancel` / `fill-book-confirm`;
      nothing-fits state). Focus on confirm when open, Enter confirms, Esc / outside / Cancel = no change, focus back to the chip.
- [ ] Confirm: one `fillBook` op (undo step "Fill book"), active spread = first changed spread, no frame selected, reveal via
      the existing placed-badge reveal helper (scroll only if out of view, zoom kept), status `fillBookStatus` for 4000 ms.
- [ ] `src/editor/FilmstripDock.tsx`: the chip first in the right group, also when Add folder… is hidden; Masters → disabled.
      `editorChromeTokens.ts` chip CSS, `editorStatus.ts` `fillBookStatus`, `src/ui/icons/glyphs.ts` + `bookImage`.
- [ ] Tests: `FilmstripDock.test.tsx` (chip present, stays without Add folder), `FillBookButton` unit test,
      `e2e/kit10-filmstrip.spec.ts` (+ `film-fill-book` pin), new `e2e/fill-book.spec.ts` (12 photos: "4 photos" / "8 photos ·
      4 spreads" / "4 → 12"; Enter → labels 1, 2–3 … 10–11, 12; page 12 holds the 12th photo; status "Placed 12 photos ·
      added 4 spreads"; "12 used"; chip disabled "Every photo is placed"; one Ctrl+Z restores; Esc no change; Masters disables).
- **Browser check:** prod editor at 1440×900, new book + 12 photos: Fill book → popover with the numbers; Enter fills the book
  (7 spreads, status); Ctrl+Z restores 3 spreads.

## Done when

- All Spec "Prod UI" bullets work in prod at 1440×900; chip h 28 and popover 296 wide / padding 12 / radius 8 match the kit ±1 px.
- `e2e/fill-book.spec.ts` green; existing filmstrip head pins (KS13 x of Unplaced / sort / Add folder) still pass.
