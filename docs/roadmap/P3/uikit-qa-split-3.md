# uikit-qa-split-3

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item uikit-qa-split-3

## Scope

Owner 2026-11-14: item 3 of the `uikit/scripts/qa.mjs` split chain (lane uikit-qa; split-1 #594, split-2 #603). Move the `split-3` rows of the split map in `docs/roadmap/P3/uikit-qa-split-1.md` out of qa.mjs into kit e2e specs, grouped by feature, same selectors, values and setup, no weakening. Stateful walks (kit10, W4) replay the walk's setup in the spec; the walk's state-changing steps stay in qa.mjs. The P2-10 `node:http` check uses the Playwright webServer at `/uikit/`; checks that relied on the global panel-visibility store set it explicitly. Waits on real conditions, no `waitForTimeout`, no raised `test.setTimeout`. Lane: `uikit/scripts/qa.mjs`, the 5 specs below, the split map (ticks only), this file. No `uikit/src/**`, `src/**`, other e2e specs or playwright config.

- [x] Batch 3 = 47 `ok()` + 5 smoke → `kit-editor-chrome` (24 + 2), `kit-credits` (2 + 0), `kit-library` (10 + 1), `kit-settings` (1 + 0), `kit-masters` (10 + 2); qa.mjs 299 → 252 `ok()`, 16 → 11 smoke
- [x] Split map rows for split-3 marked `split-3 ✓`
- **Done when:** PR body counts before / after per spec sum back (299 / 16); "moved, not deleted: <qa.mjs ranges> → <specs>"; `pnpm uikit:qa:quick` green; the 5 touched kit specs green; qa.mjs sections 0–3 untouched.
- **Browser check:** N/A (test move; the moved checks run headless in Playwright).
- **Hard nos:** no kit or product change; no backward compat (Owner 2026-11-02).
