# fill-book-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item fill-book-kit

## Scope

Designer Spec fill-book FB1 (kit), item 2 of 3 (core FB2 merged, prod FB3 next). The kit `#/demo` editor gets the "Fill book"
chip first in the filmstrip head right group (`Fill book · Unplaced · Added order · Add folder…`; the three existing chips keep
their x), its confirm popover with the numbers, and a kit `fillBook` model with the core rules F3–F9 (order E → new spreads → L,
chunks of 2, page cap, leftover = tail).

- [ ] `uikit/src/sandbox/store.tsx`: `planFillBook` / `fillBook` on the kit doc (best template + `spread()` as GapDrop does,
      placed set incl. cover, missing files skipped, filmstrip sort, kit profile page max); one `st.update(…, "Fill book")`.
- [ ] `uikit/src/sandbox/chrome.tsx` `FilmChips`: `film-fill-book` chip (lucide BookImage 14, 12/500 #393738, padding 0 10,
      h 28), disabled reasons as `title` on a wrapping span (first match wins), popover `placement="top end"` offset 4, width
      296 (rows Empty frames / New spreads / Pages, missing note, limit warning, cover note, Cancel + Fill book), focus on
      confirm, Enter confirms, Esc / Cancel no change; status after confirm; active spread = first changed spread, no frame.
- [ ] `uikit/scripts/demo-capture.mjs`: steps `editor-fill-book-open`, `editor-fill-book-done`, `editor-fill-book-undone` after
      the placed-badge steps; demo screenshots re-baselined.
- [ ] Tests: `e2e/kit-filmstrip.spec.ts` (head order + SPEC row, the fill flow on `#/demo`: rows, Enter, status, chip disabled
      "Every photo is placed", one Ctrl+Z restores, Esc no change, Masters disables, limit warning).
      `e2e/kit10-filmstrip.spec.ts` drives the prod session editor (`openSessionEditor`), so its `film-fill-book` pin
      moves to the prod item fill-book (FB3).
- **Browser check:** kit `#/demo`: click Fill book → popover 296 wide with the numbers; Enter fills the book; Ctrl+Z undoes it.

## Done when

- kit-filmstrip spec green; Unplaced / sort / Add folder x unchanged (KS13 pins hold).
- Popover 296 wide, rows and pages line match the kit model; the limit warning shows when the kit profile max is hit.
- One Ctrl+Z undoes the whole fill.
- demo-capture has the 3 new steps and the baseline is updated.
