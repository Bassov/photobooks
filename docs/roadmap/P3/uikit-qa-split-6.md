# uikit-qa-split-6

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item uikit-qa-split-6
Status: done

## Scope

Owner 2026-11-14: item 6, the last of the `uikit/scripts/qa.mjs` split chain (lane uikit-qa; split-1 #594, split-2 #603, split-3 #611, split-4 #615, split-5 #621). Move the `split-6` rows of the split map in `docs/roadmap/P3/uikit-qa-split-1.md` out of qa.mjs into kit e2e specs, grouped by feature, same selectors, values and setup, no weakening. Printer presets join the existing `e2e/kit-print-presets.spec.ts` (its design-r21 tests keep their own `beforeEach` in a describe; the qa.mjs Chrome flags become file-level). Helpers nothing left uses go; sections 0–3 stay. Waits on real conditions, no `waitForTimeout`, no raised `test.setTimeout`. Lane: `uikit/scripts/qa.mjs`, the 3 specs below, the split map (rows only), this file. No `uikit/src/**`, `src/**`, other e2e specs or playwright config.

- [x] Batch 6 = 50 `ok()` → `kit-text-frames` (15), `kit-default-master` (8), `kit-print-presets` (27); qa.mjs 106 → 56 `ok()` (sections 0–3 only)
- [x] Split map rows for split-6 marked `split-6 ✓`
- **Done when:** PR body counts before / after per spec sum back (106 → 56 + 50); "moved, not deleted: <qa.mjs ranges> → <specs>"; `pnpm uikit:qa:quick` green; the 3 touched kit specs green; qa.mjs sections 0–3 untouched.
- **Browser check:** N/A (test move; the moved checks run headless in Playwright).
- **Hard nos:** no kit or product change; no backward compat (Owner 2026-11-02).
