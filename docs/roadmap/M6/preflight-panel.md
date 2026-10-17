# preflight-panel

Tag: feature
Milestone: M6
Title: print warnings

## Scope

- [ ] Warnings panel grouped by severity with jump-to-spread; live error / warning count in the status bar
- **Perf:** preflight recomputed per changed spread only, via `startTransition`.
- **Browser check:** a low-resolution photo scaled up shows a DPI warning; the status bar count updates; clicking it jumps to the spread.
- **UI ref:** `uikit#/feature/preflight-panel`
