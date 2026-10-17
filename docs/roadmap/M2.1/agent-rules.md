# agent-rules

Tag: prep
Milestone: M2.1
Title: agents never weaken gates, grow the roadmap instead of the PR, and resolve reviewer findings themselves (issue #72 E)

## Scope

- [x] `AGENTS.md` (one line), `openspec/config.yaml` quality bar and `docs/lessons.md` (extend the "do not weaken tsconfig / ESLint" line): agents MUST NOT add or widen coverage or mutation exclusions, add inline ignore / disable comments (except equivalent-mutant disables within budget, see `stryker-diff-gate`), lower thresholds or remove checks to make a gate pass. They fix it with code, tests or a new test seam
- [x] Growth rule in `openspec/config.yaml` `rules.proposal` / `operations.apply` and in "Change size" in the roadmap rules (`docs/roadmap/RULES.md`). When a PR is about to exceed the size budget, add a new checkbox right after the current item (same milestone, kebab-case name, scope, **Done when:**), move the overflow there, and finish within the limit. Deferred review findings become checkboxes right after the current item
- [x] `.cursor/commands/next-roadmap-item.md`: remove the "security-tagged item" stop. Security-tagged items run the Security Review sub-agent before archive, and new dependencies rely on `dependency-policy`. A gate-config edit needs no stop because the ratchet only allows stricter values. `.cursor/rules/git-finish.mdc`: fix red checks only with code and tests, never with gate config
- [x] Reviewer sub-agents decide. Blocking (critical / high) findings from `openspec-proposal-reviewer`, `openspec-design-reviewer`, `openspec-implementation-reviewer`, the Security Review sub-agent and, once added, `adversarial-reviewer` are fixed or turned into checkboxes right after the current item. The PR body records each verdict and what happened to each finding
- [x] `openspec-implementation-reviewer.md`: a gate-file edit, or a config edit outside the design touch-set, is `high`. Excluding a file that the same diff modifies is `critical`. `rules.design`: the touch-set lists every gate-file edit with a reason
- **Done when:** the rules above are in place, and a dry-run planning of an oversized item (recorded in the change) shows the overflow added as the next checkbox instead of a larger PR.
