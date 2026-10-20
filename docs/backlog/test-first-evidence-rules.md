# test-first-evidence-rules

Tag: prep
Milestone: M2.1
Title: scenarios first, honest ticks (issue #72 D, E)

## Scope

- [ ] `openspec/config.yaml` `rules.design`: a required **State transitions and adversarial scenarios** section (cancel, permission denied, second tab, navigation during autosave, IDB failure, switching libraries with a contentful book open). Each scenario maps to a named test. `openspec-planning-reviewer` fails a design without it
- [ ] Every bug found in review or QA gets a failing-first regression test. The PR body names the test and the run or commit where it failed before the fix
- [ ] `rules.tasks`: spec deltas MUST NOT claim behaviour that is not implemented. The mechanical tick-evidence scan lives in `agent-self-check`
- [ ] `openspec-implementation-reviewer.md`: compare each spec-delta `SHALL` / scenario with code and tests; an unbacked claim or a design scenario without its mapped test is `high`
- [ ] `.cursor/skills/write-tests/SKILL.md`: realistic fixtures; no-permission paths with permission off; never enable a precondition before the check under test
- [ ] Reviewer fixtures: three recorded change folders (unbacked SHALL, unmapped scenario, ticked box without evidence) under `openspec/fixtures/review/`
- **Done when:** run on the three reviewer fixtures, the reviewers flag each defect as `high` in three consecutive runs, and `agent-self-check` fails the ticked-without-evidence fixture mechanically.
- **Size:** ~400 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 D, E
