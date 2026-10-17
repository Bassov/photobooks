# agent-auto-merge

Tag: prep
Milestone: M2.1
Title: agents merge their own PRs (off by default)

## Scope

- [ ] `quality/agent-policy.yaml` `autoMerge: false`. Only the owner enables it, with a PR whose only change is that line; agents MUST NOT change it, and the ratchet rejects the flip mixed with anything else
- [ ] When the flag is on, `.cursor/rules/git-finish.mdc` merges (`gh pr merge --squash --match-head-commit <sha> --delete-branch`) only if: not draft, no conflicts, up to date with `main`; every required check is green on the head SHA (`checks`, `integration`, `lighthouse`, `stryker-diff`, `pr-policy`, `dependency-review`, `codecov/patch`, `codecov/project`, `preview-qa`); `check-pr-body` passes (verdicts on the head SHA, metrics block on the head SHA); no `@flaky` entries touched by the diff; the initial-scope size check is green; no unresolved review threads and no `hold` label
- [ ] After the merge, the agent waits for `prod-smoke`. If it is red, the fix becomes the next checkbox and the unattended run stops starting new items
- **Done when:** with the flag off nothing changes, and a dry-run with the flag on lists every condition and refuses to merge when any one fails.
- **Size:** ~400 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 N
