# perf-baseline-aware

Tag: prep
Milestone: P2
Title: Bug: perf lane — a scenario red on main does not fail PRs that leave it alone
Status: done

Kind: process (P-20261103-0148-1). Main `perf` was red about 8 h on 2026-11-02 (warm-slice LoAF, fixed by #396); approved PRs #394 and #398 were blocked only by that same red, and workers / reviewers spent turns proving "red on main too". Root cause: `scripts/perf-lane.mjs` judges a PR head alone and cannot know a failing scenario already fails on the base.

## Scope

- [ ] Push runs on main upload a small per-scenario verdict JSON (`perf-verdict` artifact).
- [ ] On `pull_request`, `perf.yml` downloads the verdict of the latest completed (success / failure) `perf` push run on the base branch (`GITHUB_TOKEN`, `gh run download`); missing or unreadable → no baseline.
- [ ] `scripts/perf-lane.mjs verdict`: a scenario red on the PR AND red on that base run, whose spec and source path list the PR leaves alone, is written to the step summary as "pre-existing on main (<run url>)" and does not fail the job. Touched, base green, or base unknown → fails as today.
- [ ] Unit test for the decision function (4 cases) and a dry-run fixture through `main(['verdict', …])` that writes "pre-existing on main" to the step summary.
- [ ] `docs/agent-loop.md`: one sentence on the pre-existing rule beside the `perf` lane line (no "red on main too, wait" line exists).
- **Done when:** unit test covers base red + PR red + untouched → pass; touched → fail; base green → fail; base unknown → fail; a dry-run fixture shows "pre-existing on main" in the step summary; `perf` stays required; no threshold changed (diff of PERF_BUDGETS / `quality/gates.json` = none).
- **Test:** unit (`scripts/perf-baseline.test.mjs`) + dry run in the PR body
- **Hard nos:** no change to thresholds, PERF_BUDGETS, the 3-run rule, the nightly or the required status of `perf`; no `src/` edits
- **Sunset:** when the perf lane goes 14 days without red on main, the baseline lookup can go and the plain gate stays
