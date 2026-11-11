## Decisions

1. Fix in the rig's reusable workflow, not in photobooks: fetch the PR head without `--depth=1`, then `MB=$(git merge-base "$PR_POLICY_BASE_SHA" refs/gate-ratchet/head)` and `--base-ref "$MB"`. `check-gate-ratchet.mjs` already diffs whatever ref it is given. The script still runs from the base checkout, and the head stays data.
2. Pin the caller to the rig PR head sha (`d98239cc…`), not a branch. An immutable ref keeps `pull_request_target` from running moving code. The orchestrator swaps it to the tag after the rig PR merges.
3. Gate strictness: comparing against the fork point drops only the false `test-file-deleted` (and other "loosened") hits for files that `main` changed after the fork. Every change the PR itself makes is still diffed. Not weaker.

## Touch-set & Test Plan

| Path                                       | Reason                                        |
| ------------------------------------------ | --------------------------------------------- |
| `.github/workflows/pr-policy.yml`          | quality-gate config: rig pin → merge-base fix |
| `docs/roadmap/P4/ratchet-merge-base-ci.md` | item scope (stub filled)                      |

- Reuse: rig `readTreeFromGitRef` / `compareGateTrees`.
- Tests: in the rig (`src/check-gate-ratchet.test.mjs`): a fork-point tmp repo (a spec added on base after the fork is not flagged; a spec deleted on head is) plus workflow asserts (no `--depth`, `--base-ref "$MB"`). No photobooks unit/e2e: no `src/` change.
