# agent-rules

Tag: prep
Milestone: M2.1
Title: agents never weaken gates, grow the roadmap instead of the PR, and resolve reviewer findings themselves (issue #72 E)
Status: done

## Scope

- [x] `AGENTS.md` (one line) and `openspec/config.yaml` quality bar (extend the "do not weaken tsconfig / ESLint" line): agents MUST NOT weaken a quality gate for any reason (including stabilizing a test). Weakening includes widening coverage/mutation exclusions, inline ignore/disable, lowering thresholds, removing checks, loosening assertions/tolerances, retries/`skip`/`fixme`/`test.fail`, or deleting tests/helpers. No `Stryker disable` until `stryker-diff-gate` defines a budget. Fix with code, tests or a new test seam
- [x] Growth rule in `openspec/config.yaml` `rules.proposal` / `operations.apply` and in "Change size" in the roadmap rules (`docs/roadmap/RULES.md`). When a PR is about to exceed the size budget, add a new checkbox right after the current item (same milestone, kebab-case name, scope, **Done when:**), move the overflow there, and finish within the limit. Deferred review findings become checkboxes right after the current item. Line-count target/max live in RULES.md; config points there instead of restating numbers
- [x] `.cursor/commands/next-roadmap-item.md`: remove the "security-tagged item" stop. Security-tagged items and security-surface changes run the Security Review sub-agent before archive. Until `gate-ratchet`/`gate-ratchet-ci` merge, a gate-config edit MUST be strictly stricter and listed in the touch-set with a reason, otherwise stop. Until `dependency-policy` merges, a new or changed dependency needs `pnpm audit:ci` evidence and a Security Review pass before archive. `.cursor/rules/git-finish.mdc`: fix red checks only with code and tests, never by weakening gates/assertions
- [x] Reviewer sub-agents decide. Blocking (critical / high) findings from `openspec-proposal-reviewer`, `openspec-design-reviewer`, `openspec-implementation-reviewer`, the Security Review sub-agent and, once added, `adversarial-reviewer` are fixed or turned into checkboxes right after the current item. The PR body records each verdict and what happened to each finding
- [x] `openspec-implementation-reviewer.md`: a gate-file edit that is missing from the touch-set, has no reason, or makes any gate less strict is `high`; a listed strictly stricter edit is not a finding; any other config edit outside the touch-set is `high`; excluding a file that the same diff modifies is `critical`. `rules.design` / design-reviewer: the touch-set lists every gate-file edit with a reason
- **Done when:** the rules above are in place, and a dry-run planning of an oversized item (recorded in the change) shows the overflow added as the next checkbox instead of a larger PR.
