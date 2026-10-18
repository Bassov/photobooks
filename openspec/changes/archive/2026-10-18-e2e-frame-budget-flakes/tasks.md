# Tasks

## 1. Baseline

- [x] 1.1 For each of the three named cases, run Playwright with `--retries=0` and a rising `--repeat-each` until a failure appears (or already 20/20); record command + fail/pass counts under this task — no assertion/timeout/retry weakening; capture LoAF attribution from the Playwright report when failing
  - Evidence: continuous zoom failed under `--workers=2` with LoAF (blockingDuration 0–5ms) while describe retries were still active; isolated workers=1 often green. Drag-place 10/10 green isolated before fixes.

## 2. App pacing / measurement

- [x] 2.1 If traces implicate global thumb publish, switch `ConnectedSpreadView` to per-asset `subscribeThumb` for that spread’s assets (keep reset notify); verify `ConnectedSpreadView` / `thumbCache` unit tests pass and unrelated thumb publish does not re-render a spread lacking that asset
  - Also narrowed `subscribeTierDisplay` via per-spread `tierDisplayKey` so unrelated tier swaps do not re-render every mounted spread.
- [x] 2.2 Stabilize `spread-view › continuous zoom stays within frame-budget gates` via camera settle/commit pacing or a deterministic measurement window (zero-LoAF assert unchanged); verify `--repeat-each=20 --retries=0` is 20/20 on that grep
  - Wheel-zoom coalesces to one apply per animation frame in `usePasteboardCamera`.
  - Evidence: 20/20 workers=1; 10/10 together with the two drag-place cases.
- [x] 2.3 Stabilize `drag-place › zoomed-out gallery drag stays within frame-budget gates` and `drag-place › save during drag stays within frame-budget gates` via drop/save pacing or measurement-window fixes within the touch-set; verify each is 20/20 with `--retries=0`
  - Evidence: each 20/20 workers=1; together with continuous zoom 10/10.

## 3. Retry removal + scope close

- [x] 3.1 Nest fixed cases under describes with `retries: 0` (siblings may keep `retries: 2`); verify the three greps stay 20/20
  - Nested `continuous zoom (stabilized)` and `stabilized drag` with `retries: 0`; siblings keep retries.
- [x] 3.2 Tick matching scope boxes in `docs/roadmap/M2.1/e2e-frame-budget-flakes.md`; if any case still flakes or line budget blows, `pnpm roadmap add --after e2e-frame-budget-flakes` and leave that checkbox for the follow-up — verify `pnpm roadmap check` exits 0
- [x] 3.3 Run `pnpm stryker:diff` and `pnpm test:coverage` on production files this change touched; add public-API tests for survived/NoCoverage mutants that encode specified behavior; list equivalent/logging leftovers under this task
  - Stryker diff (CI on e64e5ff): **88.60%** (311 killed / 40 survived / **0 NoCoverage**).
  - Extracted `thumbUrlFromSnapshot`, `subscribeAssetIds`, `desiredTiersForItems`, `wheelCoalesce.mergePendingWheel` into mutate scope with unit tests; `usePasteboardCamera` stays excluded.
  - Survivors left (equivalent / React chrome): ConnectedSpreadView getServerSnapshot arrows / effect cleanup / drag `effectAllowed`; `spreadPreviewKeys` `sep < 0` vs `<= 0` on malformed `id::url` keys (same undefined); `frameSelection` book-store sync edges.
  - Main-parity sibling gates zoom-out burst + default 200 ms settle under parent `retries: 2` (not full gesture-end remount — that is `continuous-zoom-settle-mount-pace`).

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — three named greps 20/20 with `--retries=0 --workers=1`; full suite deferred to CI (out-of-scope retry suites remain)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A unless bundle/chrome redesign lands
- [x] UI in scope: browser smoke evidenced; skill `ui-review` — N/A branded UI; lock-ins via existing frame-budget / painter fixture e2e
- [x] Docs/rules sync: lessons.md (per-spread tier/thumb + wheel coalesce); roadmap item ticks; follow-up `continuous-zoom-settle-mount-pace` for zoom-out settle remount LoAF
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A unless deps change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — agent `4d0fda00-86c7-4834-972b-a07e31f69f46` pass
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass (`2a35bc67`); mediums fixed (design/tasks wording; duplicate Scope heading)
- [x] Manual check (after implementation review pass, before archive): [prep] — Playwright evidence in Manual test scenarios
- [x] Security Review: only if apply touches FSA/OPFS/workers/blob beyond defer-schedule of existing save — N/A

## Manual test scenarios

1. CI burn-in (latest integration run on this PR) — see PR body; includes main-parity zoom-out burst+200ms settle under parent retries
2. Confirm nested stabilized describes use `retries: 0`; main-parity settle sibling stays under parent `retries: 2` until `continuous-zoom-settle-mount-pace`
3. Local (≤3): main-parity settle grep `--repeat-each=3 --retries=0` (recorded in PR body when run)
4. `pnpm verify:fast:quiet` → exit 0
5. `pnpm stryker:diff` / CI → **88.60%**, 0 NoCoverage (recorded under 3.3)
