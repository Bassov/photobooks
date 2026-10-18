# Proposal

## Why

Since e2e burn-in landed, agent item runs ballooned from ~30–40 min to 1–2.5 h, mostly from local e2e re-runs and noisy test output. Why now: CI already owns 10× flake proof, so local repeats add cost without signal.

## What Changes

- Document a local test policy: targeted quiet unit + changed e2e once; CI burn-in owns flake proof; local `--repeat-each=3` only when a flake surfaced locally.
- Add a quiet targeted e2e entry that resolves the same changed-spec set as burn-in and prints failures plus a one-line summary.
- Stop `pnpm agent finish` / `/next-roadmap-item` from watching CI after push; open/update the PR and stop (reviewer reads CI).
- Make CI burn-in no-target path exit immediately (“no targets”) without browser install/build, and run that job in parallel with the main integration e2e job.
- Auto-record per-run wall time (and token usage when the CLI reports it) in PR body metrics for later audit.

**Out of scope:** changing burn-in repeat count or main-suite retry policy; full agent-pipeline-run-audit tooling; product UI.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `agent-context`: local agent test-run budget; finish stops after PR open; PR metrics include wall time / optional tokens.
- `ci-gates`: burn-in no-op path is fast and parallel with integration (no browser install when no targets).

## Impact

- Agent navigation, unattended command, and git-finish behavior for local tests and post-push CI watching.
- Agent finish pipeline and PR body metrics.
- Integration workflow burn-in job graph and no-target short-circuit.
- Scripted target resolution shared by local quiet e2e and CI burn-in.

## Success criteria

- Docs/command state the local once-green policy and the no-CI-watch finish rule.
- Quiet changed-e2e run uses the same target set as burn-in and surfaces only failures plus a one-line summary.
- After finish, the PR body metrics include per-run wall time and token usage when the CLI reports it.
- Burn-in no-op on a no-e2e PR is measurable under 1 min (this PR’s CI is acceptable evidence).
- A small agent run shows no local e2e repeat loop (note for `agent-pipeline-run-audit` if full audit is later).

## Risks

- Agents may push with a latent local miss that CI catches later — accepted; burn-in remains the flake authority.
- Splitting burn-in from integration must not drop e2e section metrics on the CI report comment.
- Keeping both capability deltas in one PR stays within ≤8 tasks / ~1k lines; overflow becomes a follow-up roadmap item, not a larger PR.
