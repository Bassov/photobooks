## Implementation

- [x] 1. `docs/agent-loop.md`: drop "needs final PR body" from C2.
- [x] 2. `openspec/config.yaml`: drop "Copy into the PR body", verdicts live in tasks.md / reviewer output.
- [x] 3. `checks.yml`: waiver from live PR via `gh pr view --json body`, random env delimiter, payload fallback.
- [x] 4. Roadmap: add `rig-pr-body-gate-removal` for the rig-side work.

## Manual test scenarios

N/A (docs + workflow only; checks and pr-policy on the PR are the evidence).
