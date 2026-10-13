## ADDED Requirements

### Requirement: Lessons journal for agents

The repository SHALL provide `docs/lessons.md` as a living journal of repeated review findings. Per-change mandates in `openspec/config.yaml` SHALL require agents to read it before apply and to append a lesson when a review finding repeats. `AGENTS.md` SHALL link to the file for navigation only (no duplicated checklist).

#### Scenario: Lessons file present

- **WHEN** an agent opens `docs/lessons.md`
- **THEN** the file exists and contains short durable rules derived from past mistakes

#### Scenario: Mandates reference lessons

- **WHEN** an agent loads OpenSpec apply guidance from `openspec/config.yaml`
- **THEN** the guidance requires reading `docs/lessons.md` before apply and appending a lesson when a review finding repeats

#### Scenario: AGENTS links lessons without checklist duplication

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to `docs/lessons.md` and MUST NOT find a duplicated verification checklist for lessons updates

### Requirement: Exploratory findings lock into Playwright e2e

When an exploratory browser or MCP session reveals a product bug that is fixed in a change, that change SHALL include a Playwright test under `e2e/` that would have failed before the fix. OpenSpec quality-bar or apply guidance SHALL state this rule.

#### Scenario: MCP or exploratory bug becomes e2e

- **WHEN** a change fixes a bug found via exploratory or MCP browser interaction
- **THEN** the change includes a Playwright test under `e2e/` covering that failure mode before apply is treated as complete

#### Scenario: Mandate is loadable

- **WHEN** an agent loads OpenSpec instructions that include the project quality bar or apply guidance
- **THEN** the returned text includes the exploratory/MCP → Playwright e2e lock-in rule

### Requirement: Future architecture notes

The repository SHALL provide `docs/future-architecture.md` describing deferred book-core layout (`src/core`, shared render) and deferred visual-regression e2e, with a link to the tracking GitHub issue for screenshot tests when one exists. `AGENTS.md` SHALL link to this doc for navigation.

#### Scenario: Future-architecture doc present

- **WHEN** an agent opens `docs/future-architecture.md`
- **THEN** it can find deferred book-core and visual-regression guidance without implementing those features in the current tree

#### Scenario: AGENTS links future architecture

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to `docs/future-architecture.md`
