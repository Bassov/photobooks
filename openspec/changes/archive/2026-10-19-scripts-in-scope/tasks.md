# Tasks

## 1. Globs + CLI excludes

- [x] 1.1 Replace script hand-lists in `vite.config.ts` coverage `include`, `stryker.config.mjs` `mutate`, and `codecov.yml` `flags.unit.paths` with `scripts/**/*.mjs` / `scripts/`; exclude `scripts/**/*.test.mjs` and ≤10-line delegating CLIs (leave >10-line CLIs in scope); document bangs in `stryker.mutate.md`.
- [x] 1.2 Add `scripts/foo.mjs` probe (pure helper used by script listing / tests) so a new path is covered without further config edit.

## 2. Mutation-scope + ratchet

- [x] 2.1 Extend `check-mutation-scope.mjs` to classify production `scripts/**/*.mjs` (skip tests; respect CLI bangs); add `check-mutation-scope.test.mjs` proving unclassified script fails the checker.
- [x] 2.2 Update `check-gate-ratchet.mjs` (+ `script-include-ratchet.mjs` + tests): include glob subsumption; fail when `scripts/**` / `scripts/**/*.mjs` removed; allow paired script test/CLI excludes when scripts glob present; Codecov `scripts/` covers former per-file paths.

## 3. Verify Done-when

- [x] 3.1 Prove on this head: `scripts/foo.mjs` in coverage + `stryker:diff` mutate set; unclassified script fails `verify:fast` / checker; removing scripts glob from include fails pr-policy (fixture via real helpers). Grow roadmap for any first-touched script that cannot hit ≥85 / 0 NoCoverage — never exclude.
- [x] 3.2 `pnpm check` (OK lines only); targeted vitest; `pnpm stryker:diff` on touched scripts ≥85 with 0 NoCoverage; tick roadmap Scope/Done-when with observed numbers only.
  - Observed `pnpm stryker:diff`: overall **85.16%** (1516 killed / 271 survived / 39 timeout / **0 NoCoverage**). Coverage after glob: statements **91.28%**.

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (prep/CI, no UI)
- [x] pnpm stryker:diff — **85.16%**, 0 NoCoverage (observed above)
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced — N/A
- [x] Docs/rules sync: ci-gates delta; roadmap ticks; no AGENTS/alwaysApply changes needed
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced) — pass after delta re-review (thin-CLI ≤10+invoke; foo literal; design trim)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass after invoke-required thin CLI + task ticks + design amend for 11-line CLI
- [x] Manual check (after implementation review pass, before archive): N/A — prep/CI gate; no UI. See Manual test scenarios.
- [x] Security Review: N/A (not security-tagged; no security-surface product change; pr-policy stays base-exec / head-as-data)

## Manual test scenarios

N/A — prep/CI gate; no UI.

### Fixture Done-when (real helpers)

1. `classifyMutationFile('scripts/foo.mjs', loadMutatePatterns())` → `in-scope` (no config edit) — `check-mutation-scope.test.mjs` / `mutation-scope.test.mjs`.
2. `runMutationScopeCheck` with unclassified `scripts/orphan-gate.mjs` → exit 1 — `check-mutation-scope.test.mjs`.
3. `compareGateTrees` / `compareScriptScopeGates`: remove `scripts/**/*.mjs` from include → `include-removed` — `check-gate-ratchet.test.mjs` / `script-include-ratchet.test.mjs`.
