# add-spread-camera

Tag: feature
Milestone: M1
Title: Add spread keeps the committed zoom and reveals the new spread after layout, without jumping scrollHeight early

## Scope

- **Perf:** reveal runs after layout; committed zoom is one camera write (no React zoom reset).
- **Browser check:** Fit spread, then Add spread — zoom percent unchanged; new spread appears inside the pasteboard after layout; no page-level H/V scroll.
- **UI ref:** `uikit#/feature/add-spread-camera`
