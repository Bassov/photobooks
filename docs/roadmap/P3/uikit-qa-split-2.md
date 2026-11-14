# uikit-qa-split-2

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item uikit-qa-split-2
Status: done

## Scope

Owner 2026-11-14: item 2 of the `uikit/scripts/qa.mjs` split chain (lane uikit-qa; item 1 = `uikit-qa-split-1`, #594). Move the `split-2` rows of the split map in `docs/roadmap/P3/uikit-qa-split-1.md` out of qa.mjs into kit e2e specs, grouped by feature, same selectors, values and setup, no weakening. Stateful walks (kit10, W3) replay the walk's setup in the spec; the walk's state-changing steps stay in qa.mjs. Waits on real conditions, no `waitForTimeout`, no raised `test.setTimeout`. Lane: `uikit/scripts/qa.mjs`, the 5 specs below, the split map (ticks only), this file. No `uikit/src/**`, `src/**`, other e2e specs or playwright config.

- [x] Batch 2 = 23 `ok()` + 14 smoke → `kit-spread-list` (2 + 3), `kit-book-settings` (2 + 1), `kit-sliders` (1 + 4), `kit-toggle-size` (0 + 2), `kit-tokens` (18 + 4); qa.mjs 322 → 299 `ok()`, 30 → 16 smoke
- [x] Split map rows for split-2 marked `split-2 ✓`
- **Done when:** PR body counts before / after per spec sum back (322 / 30); "moved, not deleted: <qa.mjs ranges> → <specs>"; `pnpm uikit:qa:quick` green; the 5 touched kit specs green; qa.mjs sections 0–3 untouched.
- **Browser check:** N/A (test move; the moved checks run headless in Playwright).
- **Hard nos:** no kit or product change; no backward compat (Owner 2026-11-02).
