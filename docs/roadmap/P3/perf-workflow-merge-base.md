# perf-workflow-merge-base

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item perf-workflow-merge-base
Status: done

## Scope

- [ ] `.github/workflows/perf.yml` path filter resolves the merge base with the PR base: no `--depth=1` re-fetch of the base after the full-history checkout, and a scope failure fails the step (no `| tee` swallowing the exit code).
- [ ] `scripts/perf-lane.mjs scope` exits non-zero with a loud error when git cannot diff against the base (no merge base, bad ref); it never falls back to "not in scope". A unit test runs it in a repo with no merge base.
- [ ] Every other workflow / script with the same shallow base fetch + `...HEAD` diff is fixed or listed in the PR body with a reason (`integration.yml` burn-in targets).
- **Done when:** this PR's perf job scope step prints a real `in_scope=` decision with no `no merge base` error (log line quoted in the PR body) and, since it touches `perf.yml` / `perf-lane.mjs`, runs the 3 measured runs; PERF_BUDGETS unchanged.
- **Browser check:** N/A (CI only, no UI change).
