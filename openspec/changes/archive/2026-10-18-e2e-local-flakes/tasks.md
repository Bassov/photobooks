# Tasks

## 1. Baseline

- [x] 1.1 For each named case, run Playwright with `--retries=0` and a rising `--repeat-each` until a failure appears (or 20/20 already green); record command + fail/pass counts under this task — no assertion/timeout/retry weakening
  - Evidence: under full-suite load with describe retries stripped, failures included template-unplace thumbs 1/2, filmstrip mixed-aspect thumbs 3/5, open-save place with 0 frames; isolated `--repeat-each=10` was often green (background-tab rAF).

## 2. Open / autosave hydrate

- [x] 2.1 Stabilize `open-save › fresh session Open loads saved book with thumbs and frames` via app settle or signal waits within the touch-set; verify lock-ins remain and `--repeat-each=20 --retries=0` is 20/20
- [x] 2.2 Stabilize `autosave › autosave persists edits across reload without manual Save` the same way; verify lock-ins and 20/20

## 3. Filmstrip packing + template unplace

- [x] 3.1 Stabilize `filmstrip › mixed aspect cards pack with uniform gaps…` without loosening gap tolerances; verify 20/20
- [x] 3.2 Stabilize `template-unplace › a smaller template unplaces overflow photos…`, then remove that describe’s `retries: 2`; verify 20/20 with `--retries=0`

## 4. Drag-swap keyboard

- [x] 4.1 Stabilize `drag-swap › escape cancels a move source and Delete unplaces a focused frame`; verify lock-ins and 20/20

## 5. Scope close

- [x] 5.1 Tick matching scope boxes in `docs/roadmap/M2.1/e2e-local-flakes.md`; if any case still flakes or line budget blows, `pnpm roadmap add --after e2e-local-flakes` (one leftover case per item) and leave that checkbox for the follow-up — verify `pnpm roadmap check` exits 0
- [x] 5.2 Run `pnpm stryker:diff` and `pnpm test:coverage` on production files this change touched; add public-API tests for survived/NoCoverage mutants that encode specified behavior; list equivalent/logging leftovers under this task
  - Coverage: statements 90.9% / lines 90.54% (suite-wide).
  - Stryker diff: score 78.71 (≥ break 60); added ConnectedSpreadView thumb-fallback unit test for the preview coalesce.
  - Survivors left (equivalent / reset bookkeeping / React wiring): `thumbCache` `lastThumb.clear` / `hydrateInflight.clear` on reset; remaining `bookStore` / `ConnectedSpreadView` chrome — not specified product branches.

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — named cases 20/20; full suite green aside from out-of-scope frame-budget LoAF flakes (`e2e-frame-budget-flakes`)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no bundle/UI chrome redesign)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A branded UI; lock-ins via existing e2e document-fit / pasteboard scrollport assertions on open-save/autosave paths
- [x] Docs/rules sync: lessons.md append (rAF background throttle); roadmap item ticks
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — agent `c2202e6e-d709-484d-a402-de57fbef581f` pass
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass (a4212017); mediums addressed (design touch-set, rAF+32ms watchdog, bookStore watchdog unit test, subscribeThumb)
- [x] Manual check (after implementation review pass, before archive): [prep] — Playwright evidence below stands in for Browser check
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (readiness/waits + thumb publish; FSA/OPFS surface unchanged)

## Manual test scenarios

1. `node scripts/with-playwright-env.mjs pnpm exec playwright test e2e/open-save.spec.ts -g "fresh session Open" --repeat-each=20 --retries=0` → 20/20
2. Same for filmstrip mixed-aspect, template-unplace overflow, autosave persists, drag-swap escape → each 20/20
3. Five named greps together under parallel workers, 5 contention loops → 5/5 green each loop
4. `pnpm verify:fast:quiet` → exit 0 (1065 unit tests)
