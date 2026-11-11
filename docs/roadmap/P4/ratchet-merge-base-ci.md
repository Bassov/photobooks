# ratchet-merge-base-ci

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item ratchet-merge-base-ci

## Scope

Process item P-20261112-0201-2: `pr-policy` must stop reporting `test-file-deleted` for specs that `main` added after the PR branch forked (each false fail costs an update-branch and a 42-min CI rerun).

- [ ] ts-agent-rig PR: the reusable `pr-policy.yml` fetches the PR head without `--depth=1` and passes `--base-ref "$(git merge-base base.sha head)"` instead of the base tip; base script only, head parsed as data.
- [ ] Rig test: a spec added only on base after the fork is not `test-file-deleted`; a spec deleted on head still is.
- [ ] `.github/workflows/pr-policy.yml` `uses:` pins the rig PR head commit (the orchestrator swaps it to the release tag after the rig PR merges). No `@albasov/ts-agent-rig` package bump.
- **Done when:** the rig test passes, the rig PR is open, the photobooks pin points at its head commit, and the PR body links the rig PR and explains when the fix is proven.
- **Browser check:** N/A (CI workflow only).
