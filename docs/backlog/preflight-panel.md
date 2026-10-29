# preflight-panel

Tag: feature
Milestone: M6
Title: print warnings

## Scope

- [ ] Warnings panel grouped by severity with jump-to-spread; live error / warning count in the status bar
- **Perf:** preflight recomputed per changed spread only, via `startTransition`.
- **Browser check:** a low-resolution photo scaled up shows a DPI warning; the status bar count updates; clicking it jumps to the spread.
- **UI ref:** `kit v0.9.3 #/feature/preflight-panel (removed in kit v0.10.0, no replacement)`
- **UI kit:** none in v0.10.0 (kit v0.9.3 `#/feature/preflight-panel`, removed) — warnings panel + jump, `uikit/src/components/ui/disclosure.tsx`

> Held 2026-10-30 (kit v0.10.0): kit page `preflight-panel` removed with no replacement; P2/P4 candidate if the Owner wants it back (Designer adds a kit page first).
