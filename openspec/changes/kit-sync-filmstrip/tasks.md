## Implementation

- [x] 1. `chrome.tsx`: export `FilmChips` (Unplaced toggle + sort menu) with prod `.film-chip` values and testids; `Dock` uses it; right gap 8; head "N of M" while Unplaced is on — `uikit/src/sandbox/chrome.tsx` `FilmChips`; kit qa "kit-sync KS13 …" PASS
- [x] 2. `demo-parts/editor.tsx`: `PhotosDock` = Relink · `FilmChips` · Add folder; `#/demo` starts on Added order — `PhotosDock`, `DEMO_VIEW.sort`; kit qa "dock header = Unplaced · Added order · Add folder…" PASS
- [x] 3. `qa.mjs`: append KS13 assertions (numbers per chip, filter, menu options, empty state) — kit-sync W5 block, 31 assertions, `uikit:qa:quick` 310 / 0

## Manual test scenarios

1. `uikit#/demo` → library → new book: dock header reads Unplaced · Added order ⌄ · Add folder…
2. Add folder… → place a photo → Unplaced on: the strip drops the placed photo, head "Photos · N of M · K used"; off restores all.
3. Sort chip → menu above the chip with Date taken / File name / Added order; pick File name → chip relabels, strip re-sorts.

Evidence (kit-only; agent manual-qa drives prod, not the kit): full kit qa `node uikit/scripts/qa.mjs` 313 passed / 0 failed / 0 console errors; `demo-baseline` walk 64 steps, no page errors.

- OK 1 — kit qa "dock header = Unplaced · Added order · Add folder…"; x / w 783.92 / 90.75, 882.67 / 127.08, 1017.75 / 110.25.
- OK 2 — kit qa "Photos · 19 of 20 · 1 used", off → 20; all placed → "Every photo is placed…"; 0 photos → "No photos yet…".
- OK 3 — kit qa menu above the chip (bottom 760 < chip top 764), 160 wide, Added order checked; File name relabels and sorts.
- ui-review: tokens `text-muted-foreground` / `bg-field` / `text-foreground`, kit primitives; labelled controls, `aria-pressed`; no blocking findings.
