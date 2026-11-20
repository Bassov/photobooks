# ci-flakes

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item ci-flakes
Status: done

## Scope

Owner 2026-11-20: find the flaky tests and CI checks of the last 14 days, name each cause and fix it instead of re-running. Mined from `gh run list` (integration + checks, 2026-11-06 … 2026-11-20): a head with a failed attempt and a later green attempt, plus every `checks` / `integration` failure classified by its failed log. The flake table, causes and fixes are in the PR body.

- [x] Flake table (test / check, runs, failures, first error line, cause, fix) for 14 days in the PR body
- [x] Every test-level flake has a root-cause fix on `origin/main` (product race or test race, no retry / timeout / skip): name the fixing PR per row
- [x] The `integration` "E2E functional hang" is named: no spec hangs; the serial (1 worker) functional suite runs 80–125 min and crosses the 120-min orchestrator hang watchdog, which cancels and re-runs it
- [x] Fixes outside this lane (`integration.yml`, `playwright.config.ts`, orchestrator watchdog, apt mirror) listed as follow-ups in the PR body
- **Browser check:** N/A (CI only); evidence: `--repeat-each=10` of the worst two e2e flakes and 20 loops under `taskset -c 0,1` of the five once-flaky unit files
- **Done when:** PR body has the flake table with cause + fix per row; fixed tests pass `--repeat-each=10` (e2e) / 20 loops under load (unit); the hang cause is named; `quality/gates.json` unchanged
- **Hard nos:** no edits to `.github/workflows/integration.yml`, `playwright.config.ts`, `stryker.config.*`, `.github/workflows/stryker-*.yml`, spec / src files of open PRs #645–#651; no loosened assertion, timeout or retry
