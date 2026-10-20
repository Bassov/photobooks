# Backlog — not on the roadmap

Owner picks items back into a milestone explicitly (`pnpm roadmap add` + move the file back).

These items left **M2.1** in the owner-directed trim of 2026-10-18 and the pipeline/gates optimization prune of 2026-10-20. File contents are unchanged except defer notes and where links would otherwise be dead.

| Slug                                                          | Title                                                                             | Original milestone | Source                          |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------ | ------------------------------- |
| [`codecov-project-components`](codecov-project-components.md) | Codecov project no-drop status and components table (owner decision 2026-10-18)   | M2.1               | #72 A; from codecov-patch-gate  |
| [`codecov-pr-comment-flags`](codecov-pr-comment-flags.md)     | Codecov PR comment shows the unit and e2e flags table (owner decision 2026-10-19) | M2.1               | #72 A; from e2e-coverage-flag   |
| [`e2e-assertion-ratchet`](e2e-assertion-ratchet.md)           | strict e2e helpers and tolerances can only get stricter (PR #76, #59)             | M2.1               | PR #76, PR #59                  |
| [`gate-ratchet-ci`](gate-ratchet-ci.md)                       | checks can't be removed or softened in workflows and tooling                      | M2.1               | #72 K                           |
| [`roadmap-check-item-body`](roadmap-check-item-body.md)       | roadmap check validates item bodies and follow-up placement (PR #82 S6)           | M2.1               | PR #82 S6, PR #80 S1, PR #81 S1 |
| [`roadmap-done-when-backfill`](roadmap-done-when-backfill.md) | Done when lines for the open M2.2 and M2.5 prep items                             | M2.1               | gap audit §1                    |
| [`dependency-policy`](dependency-policy.md)                   | dependencies are checked automatically, not asked about                           | M2.1               | —                               |
| [`test-first-evidence-rules`](test-first-evidence-rules.md)   | scenarios first, honest ticks (issue #72 D, E)                                    | M2.1               | #72 D, E                        |
| [`adversarial-reviewer`](adversarial-reviewer.md)             | adversarial reviewer sub-agent (issue #72 F)                                      | M2.1               | #72 F                           |
| [`mutation-trend`](mutation-trend.md)                         | nightly mutation trend per file (#50 item 6)                                      | M2.1               | #50 item 6                      |
| [`axe-e2e`](axe-e2e.md)                                       | automated ARIA checks in e2e (issue #72 C, #50 item 1)                            | M2.1               | #72, #50                        |
| [`lhci-key-surfaces`](lhci-key-surfaces.md)                   | Lighthouse on the real surfaces with an a11y assertion (issue #72 C, #50 item 1)  | M2.1               | #72, #50                        |
| [`keyboard-flows-e2e`](keyboard-flows-e2e.md)                 | keyboard and live-region flows (#50 item 1)                                       | M2.1               | #50                             |
| [`fsa-permission-e2e`](fsa-permission-e2e.md)                 | e2e through the real permission code (issue #72 I)                                | M2.1               | #72                             |
| [`preview-qa-run`](preview-qa-run.md)                         | the agent runs the manual scenarios on the Cloudflare preview (issue #72 G)       | M2.1               | #72                             |
| [`spec-trace`](spec-trace.md)                                 | every spec scenario has a test or a waiver (#50 item 4)                           | M2.1               | #50                             |
| [`test-hooks-out-of-prod`](test-hooks-out-of-prod.md)         | test fixtures and hooks only in e2e builds (issue #47)                            | M2.1               | #47; BRIEF §8                   |
| [`deps-rules`](deps-rules.md)                                 | stricter dependency-cruiser rules (#50 item 7)                                    | M2.1               | #50 item 7                      |
| [`perf-size-budgets`](perf-size-budgets.md)                   | enforced bundle and Lighthouse budgets (#50 item 10, issue #48)                   | M2.1               | #50 item 10, #48                |
| [`prod-smoke`](prod-smoke.md)                                 | production check after every deploy (#50 item 9)                                  | M2.1               | #50                             |
| [`agent-auto-merge`](agent-auto-merge.md)                     | agents merge their own PRs (off by default)                                       | M2.1               | #72 N                           |
| [`editor-shell-mutation`](editor-shell-mutation.md)           | mutate `EditorShell.tsx` (issue #72 B)                                            | M2.1               | pipeline-gates opt §3.1         |
| [`home-app-mutation`](home-app-mutation.md)                   | mutate HomeScreen.tsx and App.tsx (issue #72 B)                                   | M2.1               | pipeline-gates opt §3.1         |
| [`exclusions-registry`](exclusions-registry.md)               | only non-production code can be excluded (issue #72 J, A)                         | M2.1               | pipeline-gates opt §3.1         |
| [`pr-metrics-autogen`](pr-metrics-autogen.md)                 | PR metrics come from CI, never typed by hand (PR #81, #82 stale numbers)          | M2.1               | pipeline-gates opt §3.1         |
| [`no-untested-branches`](no-untested-branches.md)             | unreachable code is deleted, not defended (dead/defensive code finding)           | M2.1               | pipeline-gates opt §3.1         |
| [`diff-size-check`](diff-size-check.md)                       | size limit on an item's initial scope; review fixes warn only (issue #72 H)       | M2.1               | pipeline-gates opt §3.2         |
| [`pr-body-check`](pr-body-check.md)                           | machine-checked PR body: verdicts, dispositions, scenarios (issue #72 G)          | M2.1               | pipeline-gates opt §3.2         |
