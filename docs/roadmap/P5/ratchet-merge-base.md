# ratchet-merge-base

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item ratchet-merge-base
Status: done

Process item P-20261105-1543-1 (self-improve retro): pr-policy is the top failing check, mostly for reasons outside the PR's diff. Stale-base `[test-file-deleted]` for specs main added after the fork (the ratchet diffs head against the base tip), and runs cancelled by `cancel-in-progress` after a PR body edit.

## Scope

- [ ] `.github/workflows/pr-policy.yml`: `cancel-in-progress: false`; keep `edited` (the rig's reusable workflow reads the waiver token from the event's PR body, `PR_POLICY_BODY`).
- [ ] `lefthook.yml` pre-push: pass `GATE_RATCHET_BASE` = `git merge-base HEAD origin/main` (an explicit value wins) so the local pr-policy ratchet diffs against the fork point.
- [ ] CI pr-policy base (`pull_request.base.sha` in the rig's reusable workflow) cannot be changed from photobooks: the PR body carries a `Rig change needed` section (file, function, diff sketch).
- [ ] No `GATE_RATCHET_BASE` workaround text in worker docs (none found).
- Off limits: `src/`, `node_modules` (no vendoring), `docs/roadmap/RULES.md`, `AGENTS.md`, `README.md`, `package.json`, `scripts/vitest.setup.mjs`, `quality/gates.json` (open PR #501).
- **Done when:** a body edit of this PR leaves no cancelled or failed pr-policy run (both runs linked in the PR); a local repro on a branch forked before a main commit that adds a test shows no `test-file-deleted` with the merge-base env, while deleting a fork-point test still fails; the PR carries `Rig change needed` for the CI path.
- **Browser check:** N/A (CI / hook config only; no product code).
