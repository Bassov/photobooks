# pr-metrics-autogen

Tag: prep
Milestone: M2.1
Title: PR metrics come from CI, never typed by hand (PR #81, #82 stale numbers)

## Scope

- [ ] `scripts/ci-report-comment.mjs` also emits a machine block per head SHA: mutation score, killed / survived / NoCoverage / ignored, patch coverage %, initial-scope / review-fix / total size and `src/**` share
- [ ] `pnpm agent finish` (after green CI on the head) rewrites the `<!-- metrics:start -->…<!-- metrics:end -->` block in the PR body from that report. "Generate the PR body once" in `git-finish.mdc` and `next-roadmap-item.md` becomes "generate once; only `finish` refreshes the metrics block"
- [ ] `check-pr-body.mjs`: the block's SHA must equal the head SHA, and a mutation / coverage / size number written anywhere outside the block fails. Squash-merge guidance: commit messages carry no numbers
- [ ] `finish` reads the CI report JSON for the summary instead of separate `gh pr checks` + log calls; `--log-failed` tail only on red (moved from agent-pipeline-leftovers); Done-when clause "makes one CI-summary call" moves with it
- **Done when:** a PR body that says 88.57% while CI on the head says 88.1% fails `pr-policy`, `pnpm agent finish` on a new head refreshes the block and the check passes, and the CI report and the body show identical numbers; finish makes one CI-summary call from that report.
- **Size:** ~500 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #82 N7/N11, #81 squash message
- **Reason:** Waiting on green CI in `finish` conflicts with no-CI-poll policy; `ci-report-comment` already posts authoritative metrics (pipeline-gates opt §3.1, owner 2026-10-20).
