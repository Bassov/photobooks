# Tasks

## 1. Check runner + compact output

- [x] 1.1 Implement `scripts/check.mjs` (`runChecks` + CLI): parallel fail-all inventory (typecheck, lint, deps, knip, mutation-scope, git-test-isolation, roadmap check, unit; optional pr-policy scripts when files exist); compact OK/capped failures + `.cache/checks/*.log`; `--verbose`. Wire `package.json` `check` and alias `verify:fast` / `verify:fast:quiet`. Verify with `scripts/check.test.mjs` (multi-fail fixture shows three classes; green ≤1 OK line/check).
- [x] 1.2 Add `scripts/check.mjs` to Stryker `mutate`; keep coverage include. Verify `pnpm mutation-scope` passes and check module is in mutate globs.

## 2. Wire pre-push + CI

- [x] 2.1 Point Lefthook pre-push at `pnpm check` (via hook-clean-env). Verify lefthook.yml invokes check, not the old sequential verify:fast chain alone.
- [x] 2.2 Update `.github/workflows/checks.yml`: `pnpm check --verbose --skip-unit` for the shared inventory (coverage step owns unit); keep format:check, test:coverage, build, dist headers, audit:ci in the same required job without `continue-on-error`. Verify workflow YAML still lists those steps in `checks`.

## 3. Agent finish + preflight

- [x] 3.1 `cmdFinish`: remove duplicate pre-push verify; push with hooks; parse check failure; never `--no-verify`. Update git-finish docs. Verify agent tests: happy path invokes check once; `--no-verify` absent.
- [x] 3.2 `cmdPreflight`: warn + merge-or-recreate when behind `origin/main`; emit checklist ids when `quality/review-checklist.md` exists. Verify agent tests with tmp git repos (strip all `GIT_*`).

## 4. Docs collapse

- [x] 4.1 Point `openspec/config.yaml` quality bar / apply / tasks verification template, `AGENTS.md`, and `.cursor/commands/next-roadmap-item.md` at `pnpm check` until only OK lines. Tick roadmap scope boxes (leave pr-metrics-autogen unticked). Verify docs mention one check command and item file reflects ticks.

## 5. Verification evidence

- [x] 5.1 Run `pnpm test:coverage` / targeted agent+check tests, `pnpm stryker:diff` (85.75% killed, 0 NoCoverage on check.mjs + agent.mjs mutate set); list survivors with reasons. Confirm LOC ≤1500 vs origin/main.

### stryker:diff survivors (check.mjs / equivalent)

- spawn `stdio: ['ignore','pipe','pipe']` / options object — fake spawn ignores Node stdio wiring; covered by real-spawn main() test
- `opts.env ?? process.env` / `opts.problemCap ?? PROBLEM_CAP` — equivalent when opts omit those keys (tests always pass defaults or rely on defaults identically under `??` vs `&&` for undefined)
- `problems.length > cap` vs `>= cap` at exact boundary — equivalent at problemCap=20 with 25 problems (both show ellipsis)
- `${stderr}\n${err.message}`.trim() — equivalent for empty stderr + Error message (leading newline already dropped by line split)
- remaining extractProblemLines regex near-miss mutants (word-class tweaks) after preferred-line + fixture tests
- agent.mjs pre-existing survivors outside this change’s new branches

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (no UI; `test:e2e:changed:quiet` → no targets)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI/bundle)
- [x] UI in scope: browser smoke evidenced — N/A (prep/tooling)
- [x] Docs/rules sync: AGENTS.md, git-finish.mdc, next-roadmap-item.md, openspec/config.yaml, roadmap item ticks (pr-metrics left unticked)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dep/lock changes)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (pass after recreate-ff + auto-merge delta + optional pr-policy)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: N/A (prep; no security surface)

## Manual test scenarios

1. `pnpm check` on clean tree → eight `OK <check> (...)` lines, exit 0 (observed).
2. Agent unit suite covers multi-fail check aggregation, real failure fixtures, real-spawn main(), finish without pre-verify / without `--no-verify`, preflight fetch-before-stale + recreate-ff/merge, checklist ids (144 tests green).
3. Browser / `pnpm dev`: N/A (prep tooling; no UI).
