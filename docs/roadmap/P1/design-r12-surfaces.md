# design-r12-surfaces

Tag: feature
Milestone: P1
Title: Bug: design-r12-surfaces: cover text positions, spread-list page cards and popover menus match the kit
Status: done

## Scope

- [x] M75: cover canvas text boxes take the kit line-height 1.5: front title box 51 px (text y 197.98 at Fit), back text box 16.5 px (text y 581.52); size, weight, width and labels stay; the ratio holds at ×2.
- [x] M79: spread-list page cards are the kit card: radius 2, shadow `0 1px 2px rgba(0,0,0,.14)`; the last page is the kit LastPage (shadowSm, square); M45 / M46 / M55 / M74 values stay.
- [x] M80: popover menus (library sort, library book, create-book size) have the kit `1px transparent` border and 4 px offset; the sort menu is 176 wide at x 1198, y 50; the book menu top is 476.
- **Done when:** `e2e/design-r12-surfaces.spec.ts` green with `--repeat-each=30`; M49 / M51 / M56 / M26 / M73–M75 specs, full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900, 19 × 23 book: cover with title "Lake trip 2026" at Fit and ×2, spread 2–3 selected, then the library sort / book menus and the create-book size list; values within 0.5 px of `uikit#/demo` steps `editor-cover-photo-and-title`, `editor-spread-1`, `library-sort-menu`, `library-book-menu`, `create-book-size-menu`.
- **UI kit:** `uikit/src/sandbox/v7.tsx` (`CoverSpread` :62), `uikit/src/components/ui/popover.tsx` (offset 4 :22), `uikit/src/index.css` (no global border colour :228). UI ref: `uikit#/demo`.
- **Source:** Owner Must relayed by the Designer, round 12 (Designer review r11 of prod, 2026-11-02). Owner rule: every Designer item is a Must; round 12, Designer review r11 2026-11-02.
