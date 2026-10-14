## ADDED Requirements

### Requirement: Change sizing budget

Each OpenSpec change SHALL fit one agent apply context: at most one new subsystem, at most 8 implementation tasks in `tasks.md` (excluding the Verification checklist), and a guideline of about 1000 changed lines of source and tests. `openspec/config.yaml` proposal and tasks rules SHALL carry these limits; `docs/roadmap.md` and agent docs SHALL reference them instead of restating them. `docs/roadmap.md` SHALL define a subsystem with examples and list the slicing rules.

#### Scenario: Budget is loadable from OpenSpec instructions

- **WHEN** an agent runs `openspec instructions proposal` or `openspec instructions tasks`
- **THEN** the returned rules state the one-subsystem limit, the 8-task limit, and the ~1000-line guideline

#### Scenario: Over-budget change is split before apply

- **WHEN** a proposed change exceeds the budget
- **THEN** the agent narrows its scope and adds the remainder to `docs/roadmap.md` as new top-level checkboxes before apply starts

#### Scenario: Roadmap items fit the budget

- **WHEN** an agent reads an unchecked top-level item in `docs/roadmap.md` that has no OpenSpec change yet, in a milestone without a `**Re-plan:**` line
- **THEN** the item names at most one new subsystem, and a `[feature]` that needs both new non-UI infrastructure and a new UI region has that infrastructure in a preceding `[prep]` item

#### Scenario: Risk fallbacks are explicit items

- **WHEN** a roadmap item has a perf or memory gate whose named fallback adds its own scope
- **THEN** the fallback is a separate `[contingency]` top-level item rather than a clause inside the gated item
