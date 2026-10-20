# preflight-panel

Tag: feature
Milestone: M6
Title: print warnings

## Scope

- [ ] Warnings panel grouped by severity with jump-to-spread; live error / warning count in the status bar
- **Perf:** preflight recomputed per changed spread only, via `startTransition`.
- **Browser check:** a low-resolution photo scaled up shows a DPI warning; the status bar count updates; clicking it jumps to the spread.
- **UI ref:** `uikit#/feature/preflight-panel`
- **UI kit:** `uikit/src/features/m6m8.tsx:313-316` (`preflight-panel` demo + notes), `UI ref: uikit#/feature/preflight-panel` — warnings panel + jump, `uikit/src/components/ui/disclosure.tsx`
