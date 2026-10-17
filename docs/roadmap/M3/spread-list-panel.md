# spread-list-panel

Tag: feature
Milestone: M3
Title: spread list (Google Slides style)

## Scope

- [ ] Left panel (`Panel`) with spread thumbnails (same `SpreadView`, smallest tier, virtualized); click scrolls the pasteboard to the spread
- [ ] Add / delete / duplicate spreads
- **Perf:** thumbnails re-render only when their spread reference changes; panel resize via CSS variables, pasteboard re-measures at the end.
- **Browser check:** click a thumbnail and the pasteboard scrolls to it; add, duplicate and delete spreads from the panel; resize the panel without page-level H/V scroll.
- **UI ref:** `uikit#/feature/spread-list-panel`
