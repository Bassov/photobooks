# Backlog — not on the roadmap

Owner picks items back into a milestone explicitly (`pnpm roadmap add` + move the file back).

These items left **M2.1** in the owner-directed trim of 2026-10-18 and the pipeline/gates optimization prune of 2026-10-20, and **M2.1** / **M2.2** in the product-first prune of 2026-10-27. File contents are unchanged except defer notes and where links would otherwise be dead.

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
| [`codecov-validate-timeout`](codecov-validate-timeout.md)     | AbortSignal.timeout for Codecov YAML validate fetch                               | M2.1               | CI run 39250896481              |
| [`mutation-reinclude-small`](mutation-reinclude-small.md)     | mutate the small files that already have tests (issue #72 B)                      | M2.1               | #72 B                           |
| [`mutation-reinclude-camera`](mutation-reinclude-camera.md)   | mutate `usePasteboardCamera.ts` again (issue #72 B)                               | M2.1               | #72 B                           |
| [`project-session-mutation`](project-session-mutation.md)     | mutate what is left of `projectSession.ts` (issue #72 B)                          | M2.1               | #72 B                           |
| [`agent-pipeline-run-audit`](agent-pipeline-run-audit.md)     | Check one /next-roadmap-item run against the #77 and #79 targets                  | M2.1               | #77, #79                        |

## Held at the kit v0.10.0 roadmap update (2026-10-30)

Kit pages removed in v0.10.0 with no replacement. Owner re-adds one with `pnpm roadmap add` after Designer adds its kit page.

| Slug                                            | Title                 | Original milestone | Source                                                                                   |
| ----------------------------------------------- | --------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| [`jpeg-spreads-export`](jpeg-spreads-export.md) | JPEG spreads          | M6                 | kit v0.10.0 removal, held 2026-10-30                                                     |
| [`cover-pdf`](cover-pdf.md)                     | cover PDF             | M6                 | held; P4 after `cover-editor` once Designer adds a Cover option to the Print dialog (D3) |
| [`preflight-panel`](preflight-panel.md)         | print warnings        | M6                 | kit v0.10.0 removal, held 2026-10-30                                                     |
| [`preflight-fixes`](preflight-fixes.md)         | fix from the panel    | M6                 | kit v0.10.0 removal, held 2026-10-30                                                     |
| [`print-overlays`](print-overlays.md)           | see print constraints | M6                 | kit v0.10.0 removal, held 2026-10-30                                                     |

Deleted 2026-10-30 (Designer call D3, **Owner-confirm**): `manual-deploy` (superseded by P3 `in-app-publish`) and `print-package-report` (no kit, low value). `pdf-captions` moved back to P4.

## Held until a kit page exists (kit-first)

Designer call B1 (2026-10-30), narrowed by the Designer kit-first audit (2026-10-30): only UI absent from `uikit/src/sandbox` is held. Re-add each with `pnpm roadmap add <slug> --after <X>` once its kit page lands.

| Slug                                        | Title                     | Target P | Depends             |
| ------------------------------------------- | ------------------------- | -------- | ------------------- |
| [`guides-precise`](guides-precise.md)       | exact guides              | P2       | guides              |
| [`kit2-undo-history`](kit2-undo-history.md) | undo history list         | P2       | kit10-editor-chrome |
| [`onboarding-others`](onboarding-others.md) | first run for other users | P5       | kit10-library-books |

Moved back into P1–P5 on 2026-10-30 (present in the kit sandbox; Owner-approved scope change): `rulers`, `guides`, `dpi-badge`, `text-blocks`, `live-captions`, `parent-guides`, `parent-overrides`, `page-numbers` (P2), `connect-own-hosting` (P5). Deleted: `kit2-spread-menu` (row menu and reorder ship on main, #284; restyle folded into P1 `kit10-spread-list`) and `kit2-missing-relink` (relink ships in `src/editor/relink`; restyle folded into P1 `kit10-canvas`, `kit10-spread-list`, `kit10-filmstrip`).
