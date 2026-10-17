# agent-auto-merge

Tag: prep
Milestone: M2.1
Title: agents merge their own PRs (off by default)

## Scope

- [ ] `quality/agent-policy.yaml` `autoMerge: false`. Only the owner enables it, with a PR whose only change is that line; agents MUST NOT change it, and the ratchet rejects the flip mixed with anything else
- [ ] When the flag is on, `.cursor/rules/git-finish.mdc` merges (`gh pr merge --squash --match-head-commit <sha> --delete-branch`) only if:
  - The PR is not draft, has no conflicts and is up to date with `main`
  - Every required check is green on the head SHA: `checks`, `integration`, `lighthouse`, `stryker-diff`, `pr-policy`, `dependency-review`, `codecov/patch`, `codecov/project`, `preview-qa`
  - `check-pr-body` passes: every reviewer verdict is `pass`, and each critical / high finding is fixed or is a checkbox right after the item
  - Every manual scenario has an observed result from `preview-qa` on the same SHA
  - There are no unresolved review threads and no `hold` label (an optional brake the owner may use)
- [ ] After the merge, the agent waits for `prod-smoke`. If it is red, the fix becomes the next checkbox and the unattended run stops starting new items
- **Done when:** with the flag off nothing changes, and a dry-run with the flag on lists every condition and refuses to merge when any one fails.
