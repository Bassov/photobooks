# design-r7-spreads

Tag: feature
Milestone: P1
Title: Bug: design-r7-spreads: single pages on their side, spread-list labels, new-spread drop pill and 104/588 gap
Status: done

## Scope

- [ ] M45: page 1 and a single last page render as one page on their side of a spread-wide slot (page 1 right half, last page left half, no blank partner page), on the canvas and in the spread list, at the kit `#/demo` rects (1440 × 900, 19 × 23 book: canvas page x 676 / x 252, w 424, h 513.25; list paper x 110 / x 20, w 90, h 108.94).
- [ ] M46: spread-list labels read `1`, `a–b` for middle spreads and the single last page number (`6` for a 6-page book, `8` for an 8-page book).
- [ ] M49: while a filmstrip photo is dragged, the "Drop here for a new spread" pill is one line at a constant screen size (kit `GapDrop`: 32 px tall, 12 px text, 8 px radius), centred in the gap, never on a page number, and hidden whenever the gap cannot hold it plus the label clearance; the stack gap is 104 / 588 of the spread height.
- **Done when:** `e2e/design-r7-spreads.spec.ts` green with `--repeat-each=30`; gap specs (M26/M36, `e2e/fixtures/stackGap.ts`) updated to 104 / 588 as an Owner design change; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440×900, 19 × 23 book: page 1 sits on the right half of the canvas and the list card; the last page on the left; list labels `1 · 2–3 · 4–5 · 6`; drag a filmstrip photo over a gap at Fit and at 300 %: the same one-line pill centred in the gap, page numbers visible above it.
- **UI kit:** `uikit/src/sandbox/canvas.tsx` (`SpreadSurface` clip `inset(… 50%)` :409), `uikit/src/sandbox/v7.tsx` (`LastPage` :122, `pageLabel` :30), `uikit/src/sandbox/chrome.tsx` (list items :276-277, label `paddingLeft` :313), `uikit/src/sandbox/viewport.tsx` (`GapDrop` :262-266). UI ref: `uikit#/demo` steps 14, 17.
- **Source:** Owner Musts relayed by the Designer, round 7, 2026-11-01, on prod 68639a0.
