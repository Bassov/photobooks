## Implementation

- [x] 1. e2e `design-r13-polish.spec.ts` with kit values in the header (fails on main for M80 / M81). Before: 3 failed (trigger `matrix(0.98…)`, hint `P` / `6px 0px 12px` / 16px); after: 120 passed at `--repeat-each=30`.
- [x] 2. M80: no pressed scale on an expanded `pb-button` trigger (`src/ui/Button.css`). Book trigger 28 × 28 at y 444, menu y 476, gap 4.00.
- [x] 3. M81: Caption hint is the kit `div`, line-height 1.4 (`FrameLookSections.tsx`). Position & size header dy 121.80.

## Manual test scenarios

1. Library at 1440 × 900: open "Book actions" on "Lake trip"; the trigger stays 28 px, the menu top is 476.
2. Editor: open the Zoom menu and a spread-row menu; no shrink while open.
3. Editor: place a photo, select the frame, expand Caption; Position & size header 121.8 below CAPTION.

`pnpm agent manual-qa`: problem (harness) — all three blocked at Welcome, the `start-session` click is intercepted by the welcome header; no product assertion ran. Evidence instead from `e2e/design-r13-polish.spec.ts` (4 passed):

- OK (e2e) 1: `:89` book trigger 28 × 28, `transform: none`, menu y 476, gap 4.00.
- OK (e2e) 2: `:135` spread-row and Zoom triggers `transform: none` while open.
- OK (e2e) 3: `:183` Caption hint `DIV` / `6px 0px 0px` / 16.8px, Position & size dy 121.80.
