# stryker-diff-gate

Tag: prep
Milestone: M2.1
Title: honest mutation on the diff (issue #72 B, J)

## Scope

- [ ] Diff thresholds `{ high: 90, low: 85, break: 85 }` in `quality/gates.json`, used by a `stryker.diff.config.mjs` that spreads the nightly config. `scripts/stryker-diff.mjs` runs it and loads its mutate set from the registry (`scope: diff`). The nightly run keeps break 60. The ratchet also requires diff ≥ nightly
- [ ] After the run, `stryker-diff.mjs` fails on any `NoCoverage` mutant in changed files. `scripts/stryker-pr-summary.mjs` lists them (file:line, mutator)
- [ ] A skipped run or a changed-but-excluded file fails, with no override. The only allowance is a `temporary` registry entry until its re-include item. Partly excluded diffs list the excluded files. Update the `ci-gates` scenario "Empty mutate set"
- [ ] Equivalent mutants. The only allowed inline form is `// Stryker disable next-line <mutator>: <reason>`. It is capped at 3 per file and by a repo-wide budget in `quality/gates.json` that starts at the current count and can only shrink. Update `operations.apply` (stryker bullet) and reviewer check 5: a reason in `tasks.md` no longer counts
- **Done when:** PR #71's numbers (85.4% with 18 NoCoverage) would fail `stryker-diff`, a PR like #70 (only excluded files changed, with no `temporary` entry) fails, and a fourth disable in one file or one over the budget fails `pr-policy`.
