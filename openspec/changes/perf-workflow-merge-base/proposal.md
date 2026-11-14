## Proposal

Roadmap: `docs/roadmap/P3/perf-workflow-merge-base.md` (scope / Done when SoT).

### Scope out

- PERF_BUDGETS, LoAF thresholds and the 3-run verdict rules (unchanged).
- `src/**`, `e2e/**`, `uikit/**`; the rig's `ts-rig-gate` internals (only its caller's fetch).

### Delta / Risk

- Success: the perf job log shows the `in_scope=` line with no `no merge base`, and the 3 measured runs for an in-scope PR.
- Now in-scope PRs really run the 3 measured runs; real long tasks from our code are reported in the PR body, never loosened.
