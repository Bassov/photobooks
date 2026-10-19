# dpi-badge

Tag: feature
Milestone: M6
Title: resolution while you lay out

## Scope

- [ ] Badge on frames below the profile's warn / min DPI (book-editor defaults when no profile is chosen) on the editor overlay layer (editor-only, never in output)
- [ ] Lowest effective DPI column and sort in the assets panel; clicking a low-DPI row jumps to its frame
- **Perf:** DPI computed inside the memoized resolve per spread; one badge element per low frame; recomputed only for changed spreads. Gate: crop-zoom pan across the threshold — zero LoAF.
- **Browser check:** zoom a low-DPI photo inside its frame — the badge appears at the profile threshold and clears when zoomed out; a stricter profile flags more frames; badges never appear in presentation mode; sort the assets panel by DPI.
- **UI ref:** `uikit#/feature/dpi-badge`
- **UI kit:** `uikit/src/features/m6m8.tsx:305-308` (`dpi-badge` demo + notes), `UI ref: uikit#/feature/dpi-badge` — DPI badge + assets DPI column
