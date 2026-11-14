# uikit-qa-split-4

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item uikit-qa-split-4
Status: done

## Scope

Owner 2026-11-14: item 4 of the `uikit/scripts/qa.mjs` split chain (lane uikit-qa; split-1 #594, split-2 #603, split-3 #611). Move the `split-4` rows of the split map in `docs/roadmap/P3/uikit-qa-split-1.md` out of qa.mjs into kit e2e specs, grouped by feature, same selectors, values and setup, no weakening. Stateful walks (kit10, W4, the #/demo walks) replay their setup in the spec; checks that leaned on state left by earlier qa.mjs checks set it explicitly; the kit10 / W4 steps the split-5 checks still need stay in qa.mjs. Waits on real conditions, no `waitForTimeout`, no raised `test.setTimeout`. Lane: `uikit/scripts/qa.mjs`, the 5 specs below, the split map (ticks only), this file. No `uikit/src/**`, `src/**`, other e2e specs or playwright config.

- [x] Batch 4 = 70 `ok()` + 5 smoke → `kit-editor-canvas` (31 + 3), `kit-parent-overrides` (4 + 2), `kit-demo-sandbox` (15 + 0), `kit-site-preview` (9 + 0), `kit-personal-site` (11 + 0); qa.mjs 252 → 182 `ok()`, 11 → 6 smoke
- [x] Split map rows for split-4 marked `split-4 ✓`
- **Done when:** PR body counts before / after per spec sum back (252 / 11); "moved, not deleted: <qa.mjs ranges> → <specs>"; `pnpm uikit:qa:quick` green; the 5 touched kit specs green; qa.mjs sections 0–3 untouched.
- **Browser check:** N/A (test move; the moved checks run headless in Playwright).
- **Hard nos:** no kit or product change; no backward compat (Owner 2026-11-02).
