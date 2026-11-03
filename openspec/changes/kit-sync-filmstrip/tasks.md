## Implementation

- [x] 1. `chrome.tsx`: export `FilmChips` (Unplaced toggle + sort menu) with prod `.film-chip` values and testids; `Dock` uses it; right gap 8; head "N of M" while Unplaced is on — `uikit/src/sandbox/chrome.tsx` `FilmChips`; kit qa "kit-sync KS13 …" PASS
- [x] 2. `demo-parts/editor.tsx`: `PhotosDock` = Relink · `FilmChips` · Add folder; `#/demo` starts on Added order — `PhotosDock`, `DEMO_VIEW.sort`; kit qa "dock header = Unplaced · Added order · Add folder…" PASS
- [x] 3. `qa.mjs`: append KS13 assertions (numbers per chip, filter, menu options, empty state) — kit-sync W5 block, 31 assertions, `uikit:qa:quick` 310 / 0

## Manual test scenarios

1. `uikit#/demo` → library → new book: dock header reads Unplaced · Added order ⌄ · Add folder…
2. Add folder… → place a photo → Unplaced on: the strip drops the placed photo, head "Photos · N of M · K used"; off restores all.
3. Sort chip → menu above the chip with Date taken / File name / Added order; pick File name → chip relabels, strip re-sorts.
