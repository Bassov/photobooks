# adversarial-reviewer-pr-evidence

Tag: prep
Milestone: M2.1
Title: adversarial review and a machine-checked PR body (issue #72 F, G)

## Scope

- [ ] `.cursor/agents/adversarial-reviewer.md` (readonly). Its input is only the diff and the roadmap item goal. Task: find ways to lose or corrupt user data or break state transitions. Output: concrete repro steps. Wire it into `operations.apply` after `openspec-implementation-reviewer`. Each finding is fixed with a failing-first test or becomes a checkbox right after the current item. `operations.archive`: no archive with unresolved findings
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` sections:
  - Reviewer verdicts (one line per reviewer: verdict and finding dispositions)
  - Manual test scenarios (steps and expected result)
  - Preview run (filled by `preview-qa-run`)
  - Gate changes (stricter only)
  - New roadmap checkboxes
- [ ] `scripts/check-pr-body.mjs` in `pr-policy` (also on the `edited` event). It fails when a section is missing or empty, a verdict is not `pass`, a critical or high finding has no fix or checkbox, or a scenario lacks an expected result
- **Done when:** a PR body with a missing verdict, a `fix` verdict or a scenario without an expected result fails `pr-policy`, and a change cannot archive while adversarial findings are unresolved.
