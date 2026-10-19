# Tasks

## 1. Gates + diff config

- [x] 1.1 Add `stryker.diffThresholds` `{ high: 90, low: 85, break: 85 }` and `mutation.temporaryExcludes` (listed product paths + `until` slugs) to `quality/gates.json`; validate in `load-gates.mjs` (+ tests). Keep nightly `stryker.thresholds` break 60.
- [x] 1.2 Add `stryker.diff.config.mjs` that spreads nightly config and applies `diffThresholds`. Wire `stryker-diff.mjs` to use it.

## 2. Diff honesty + summary

- [x] 2.1 Extend `stryker-diff.mjs` / `stryker-diff-gate.mjs`: unauthorized exclude fail; skip only when no remaining production mutate work; drop `--allowEmpty` when production changed; fail on any NoCoverage after the run. Unit tests drive real helpers with fixture reports/file lists (#71-like 85.4%/18 NoCoverage fail; #82-r1-like 72.49%→72.5%/3 NoCoverage fail; excluded-not-on-temp fail; docs-only skip).
- [x] 2.2 Extend `stryker-pr-summary.mjs` to list NoCoverage (file:line, mutator) and changed files not mutated (+ tests).

## 3. Ratchet

- [x] 3.1 Extend `check-gate-ratchet.mjs`: numeric ratchet for `diffThresholds`; fail if any diff < nightly; `temporaryExcludes` seed allowed when base has no array, thereafter paths only shrink. New RULE_IDS/FIXTURE_IDS + fixture CLI proofs. Clear ambient `GIT_*` in git tests.

## 4. Verify

- [x] 4.1 `pnpm check` (OK lines only); targeted vitest for touched scripts; `pnpm stryker:diff` on touched helpers ≥85 with 0 NoCoverage; mutate-include new helpers; list true equivalents under this task if any.
  - Observed `pnpm stryker:diff`: overall **87.2%** (1875 killed / 280 survived / 38 timeout / **0 NoCoverage**); `scripts/stryker-diff-gate.mjs` **88.3%**; `scripts/stryker-pr-summary.mjs` **95.2%**; `scripts/load-gates.mjs` **92.5%**; `scripts/check-gate-ratchet.mjs` **85.0%**.
- [x] 4.2 Tick roadmap Scope/Done-when only with observed fixture + this PR CI evidence; Manual check N/A (prep/CI); archive + `pnpm roadmap done`.

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (prep/CI, no UI)
- [x] pnpm stryker:diff — **87.2%**, 0 NoCoverage (observed above)
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced — N/A
- [x] Docs/rules sync: ci-gates delta; roadmap ticks; no AGENTS/alwaysApply changes needed
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced) — pass after delta re-review (bootstrap + NoCoverage + design trim)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass after CLI fixtures + bang drift + helper ≥85
- [x] Manual check (after implementation review pass, before archive): N/A — prep/CI gate; no UI. See Manual test scenarios.
- [x] Security Review: N/A (not security-tagged; no security-surface product change; pr-policy stays base-exec / head-as-data)

## Manual test scenarios

N/A — prep/CI gate; no UI.

### Fixture Done-when (real helpers)

1. PR #71-like report (85.4%, 18 NoCoverage) → `evaluateNoCoverageGate` fails (`MSG_NO_COVERAGE18`) — vitest `stryker-diff-gate helpers`.
2. PR #82 r1-like (~72.5% one-decimal helper, 3 NoCoverage) → fails NoCoverage gate; score < 85.
3. PR #70-like (`bookLoad.worker.ts` bang-excluded, not on temp list) → `planDiffMutation` errors with unauthorized exclude.
4. Docs-only → `planDiffMutation` skip success.
