# multi-select

Tag: feature
Milestone: M4
Title: group operations

## Scope

- [ ] Shift / marquee selection, group move, align and distribute
- **Perf:** marquee hit-test via the spatial index; group move is one `transform` per selected frame in rAF.
- **Browser check:** select three frames and distribute them evenly; marquee over a full spread stays smooth.
- **UI ref:** `uikit#/feature/multi-select`
- **UI kit:** `uikit/src/features/m4.tsx:75-78` (`multi-select` demo + notes), `UI ref: uikit#/feature/multi-select` — marquee multi-select, align, distribute
