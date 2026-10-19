# Tasks

## 1. Mutate subsumption on the real ratchet path

- [x] 1.1 Extend `compareScriptScopeGates` / `extractStrykerGateBits` so removed non-bang Stryker `mutate` entries fail `include-removed` unless a remaining head mutate glob covers them (reuse `coverageIncludeCovered` / `hasScriptsCoverageInclude`; new MSGS prefix). Dropping `scripts/**/*.mjs` from mutate when base had it fails.
- [x] 1.2 Unit tests on helpers + `compareGateTrees`: hand-list→glob mutate green; uncovered mutate/include removal red.

## 2. #126 replay fixture + weakening FIXTURE_IDS

- [x] 2.1 Commit frozen real pre/post #126 configs as `scripts/fixtures/pr-126-scripts-glob.json` (no `git show` in tests); test `compareGateTrees` → 0 violations; register FIXTURE_ID `scripts-glob-pr126-replay`.
- [x] 2.2 Through `compareGateTrees` / `cliRatchet`: broad exclude (`!scripts/**`, `!src/**/*.ts`), non-thin CLI exclude, Codecov path with no covering prefix each fail; FIXTURE_IDS for each; tick roadmap Scope boxes when proven.

## 3. Verify Done-when

- [x] 3.1 `pnpm check` (OK lines only); targeted vitest; `pnpm stryker:diff` on touched scripts ≥85 with 0 NoCoverage (record observed numbers); no other gate loosened.
  - Observed final-tree `pnpm check`: OK lines only (`/tmp/check-final.txt`).
  - Observed final-tree `pnpm stryker:diff`: overall **85.40%** (1376 killed / 242 survived / 39 timeout / **0 NoCoverage**).

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below) — `/tmp/check-final.txt`
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (prep/CI, no UI)
- [x] pnpm stryker:diff — `/tmp/stryker-final.txt` OK; 0 NoCoverage
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced — N/A
- [x] Docs/rules sync: ci-gates delta; roadmap Scope ticks; no AGENTS/alwaysApply changes needed
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced) — Verdict: pass (lows fixed)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — re-review after fix findings
- [x] Manual check (after implementation review pass, before archive): N/A — prep/CI gate; no UI. See Manual test scenarios.
- [x] Security Review: N/A (not security-tagged; pr-policy stays base-exec / head-as-data)

## Manual test scenarios

N/A — prep/CI gate; no UI. Fixture proofs: `scripts-glob-pr126-replay` and Scope (3) FIXTURE_IDS in `check-gate-ratchet.test.mjs`.
