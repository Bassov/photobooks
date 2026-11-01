# design-r8-polish

Tag: feature
Milestone: P1
Title: Bug: design-r8-polish: endpaper inspector spacing, single-page list rows, new-spread pill centring

## Scope

- [ ] M48 (reopened): the "Endpaper · front" inspector rows sit at the kit `#/demo` step 26 tops (1440 × 900): FILL 121.64, Style 148.48, Pattern 187.33, APPLY 243.33, "Same on back endpaper" 270.17; the Style row spreads label, "Pattern" chip (x 1239, 60 × 26.84) and "coming later" (x 1358, 66 × 14.84) like the kit `Row`; the r7 head (57.64 tall, padding 16/16/4, title 1156/64, 13 px) is kept.
- [ ] M55: the first and last single-page rows of the spread list paint nothing in the empty half (no background, border or shadow); the page thumb keeps the kit rect (page 1 x 110, last page x 20, 90 × 108.94) and `data-page-side`; labels 1 · 2–3 · … · N.
- [ ] M56: while a filmstrip photo is dragged, the "Drop here for a new spread" pill is centred vertically between the page-number line bottom and the next spread's top (equal gaps within 0.5 px at Fit and ×2; 19.89 px at Fit); 104 / 588 gap, 32 px / 12 px, nowrap and hide-when-too-small stay.
- **Done when:** `e2e/design-r8-polish.spec.ts` green with `--repeat-each=30`; the r7 pill centring assertion updated as an Owner design change (round 8, M56); full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900, 19 × 23 book: select "Endpaper · front" and compare the rows with kit step 26; the first and last list rows show only the page; drag a filmstrip photo over a gap at Fit and at 200 %: the pill sits midway between the page numbers and the next spread.
- **UI kit:** `uikit/src/sandbox/v7.tsx` (`Sec` :130, `Row` :145, endpaper inspector :218-222), `uikit/src/sandbox/chrome.tsx` (list items :276-277). UI ref: `uikit#/demo` steps 14, 26.
- **Source:** Owner Musts relayed by the Designer, round 8, 2026-11-01, on prod 8ea1565.
