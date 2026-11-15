# uikit-qa-split-5

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item uikit-qa-split-5
Status: done

## Scope

Owner 2026-11-15: item 5 of the `uikit/scripts/qa.mjs` split chain (lane uikit-qa; split-1 #594, split-2 #603, split-3 #611, split-4 #615). Move the `split-5` rows of the split map in `docs/roadmap/P3/uikit-qa-split-1.md` out of qa.mjs into kit e2e specs, grouped by feature, same selectors, values and setup, no weakening. Stateful walks (kit10, W3, W4, W5, the #/demo books) replay their setup in the spec. These are the last smoke calls: the `smoke` / `smokeS` helpers and their 2 `ok()` sites go, and so do the helpers nothing else uses (`D`, `txt`, `E`, `scen`, `SCEN3`, `bg`, `walk6`). Static export gets its own `e2e/kit-static-export.spec.ts` (not kit-in-app-publish). Waits on real conditions, no `waitForTimeout`, no raised `test.setTimeout`. Lane: `uikit/scripts/qa.mjs`, the 5 specs below, the split map (rows only), this file. No `uikit/src/**`, `src/**`, other e2e specs or playwright config.

- [x] Batch 5 = 74 `ok()` + 6 smoke → `kit-filmstrip` (33 + 4), `kit-layout-picker` (22 + 1), `kit-frame-style` (3 + 1), `kit-cover` (13 + 0), `kit-static-export` (3 + 0); qa.mjs 182 → 106 `ok()` (74 moved + the 2 helper sites), 6 → 0 smoke
- [x] Split map rows for split-5 marked `split-5 ✓`; static export target is `e2e/kit-static-export.spec.ts`
- **Done when:** PR body counts before / after per spec sum back (182 / 6); "moved, not deleted: <qa.mjs ranges> → <specs>"; `pnpm uikit:qa:quick` green; the 5 touched kit specs green; qa.mjs sections 0–3 untouched.
- **Browser check:** N/A (test move; the moved checks run headless in Playwright).
- **Hard nos:** no kit or product change; no backward compat (Owner 2026-11-02).
