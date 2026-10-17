# test-first-evidence-rules

Tag: prep
Milestone: M2.1
Title: scenarios first, honest ticks (issue #72 D, E)

## Scope

- [ ] `openspec/config.yaml` `rules.design`: a required **State transitions and adversarial scenarios** section. It covers cancel, permission denied, a second tab, navigation during autosave, IDB failure, and switching libraries while a book with content is open. Each scenario maps to a named test. `openspec-design-reviewer` fails a design without it
- [ ] Every bug found in review or QA gets a failing-first regression test. The PR body names the test and the run or commit where it failed before the fix
- [ ] `rules.tasks`: a `tasks.md` box is ticked only with evidence next to it (a test name, a CI link or a recorded result). Spec deltas MUST NOT claim behaviour that is not implemented
- [ ] `openspec-implementation-reviewer.md`: compare each spec-delta `SHALL` / scenario with the code and tests. An unbacked claim, an unevidenced tick, or a design scenario without its mapped test is `high`
- [ ] `.cursor/skills/write-tests/SKILL.md`: realistic fixtures (books with spreads and placed photos). Test no-permission paths with permission off. Never enable a precondition before the check under test
- **Done when:** the reviewer flags a ticked box without evidence, a spec scenario with no code or test behind it, and a design scenario with no mapped test.
