# stryker-ci-green

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item stryker-ci-green
Status: done

## Scope

Owner 2026-11-20: mutation checks fail only on a real score drop.

- [ ] Nightly `stryker-full` (red every night since 2026-10-14): name the failing step and cause from the run logs and fix it; a full run that would pass the job cap is sharded with a report merge and `timeout-minutes`.
- [ ] PR `stryker-diff`: the dry run fits its timeout on a loaded runner without dropping tests from the score.
- [ ] Break 60, `quality/gates.json` thresholds, mutate excludes and the stryker-diff pass/fail rule stay unchanged.
- **Browser check:** N/A (CI only).

## Done when

- One `workflow_dispatch` run of stryker-full on the branch is green, or red only on score < 60 with the per-file list in the job summary.
- stryker-diff on this PR's own run completes its dry run (duration vs timeout stated).
- PR body: old failing step, wall time before/after, full mutation score.
