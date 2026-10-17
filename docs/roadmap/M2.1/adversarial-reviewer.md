# adversarial-reviewer

Tag: prep
Milestone: M2.1
Title: adversarial reviewer sub-agent (issue #72 F)

## Scope

- [ ] `.cursor/agents/adversarial-reviewer.md` (readonly). Input: only the diff and the roadmap item goal. Task: ways to lose or corrupt user data or break state transitions; output: concrete repro steps
- [ ] Wired into `operations.apply` after `openspec-implementation-reviewer`; each finding is fixed with a failing-first test or becomes a checkbox right after the current item; `operations.archive`: no archive with unresolved findings; its verdict line is required by `check-pr-body`
- [ ] Split from `adversarial-reviewer-pr-evidence` (the PR-body part moved to `pr-body-check`)
- **Done when:** a change cannot archive while adversarial findings are unresolved, and `check-pr-body` fails a PR without the adversarial verdict line.
- **Size:** ~250 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 F
