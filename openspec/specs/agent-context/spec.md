# agent-context Specification

## Purpose

Defines how Photobooks keeps agent navigation, OpenSpec per-change mandates, distilled skills, and CI security gates coherent so agents do not rediscover the project on every change.

## Requirements

### Requirement: OpenSpec config is the per-change mandate source

The project SHALL keep all per-change agent mandates (proposal/design/tasks verification, apply gates, archive behavior) in `openspec/config.yaml` so propose, apply, and archive workflows receive them via OpenSpec instructions.

#### Scenario: Mandates load from config

- **WHEN** an agent runs OpenSpec instructions for proposal, design, tasks, apply, or archive
- **THEN** the returned rules or operation guidance include the project's current per-change mandates from `openspec/config.yaml`

#### Scenario: No checklist duplication in navigation docs

- **WHEN** an agent reads root `AGENTS.md` or always-applied Cursor workflow rules
- **THEN** those documents MUST NOT contain a duplicate verification checklist or numbered OpenSpec pipeline that conflicts with `openspec/config.yaml`

### Requirement: Archive always syncs delta specs

When a change has delta specs, archive SHALL sync those deltas into main `openspec/specs/` and verify the merge before moving the change to the archive directory. Archive MUST NOT proceed with skip-sync while delta specs exist.

#### Scenario: Delta specs require sync before archive

- **WHEN** a completed change has one or more delta spec files and archive is requested
- **THEN** the agent syncs deltas to main specs, verifies the merge, and only then archives the change

#### Scenario: Sync blocked stops archive

- **WHEN** delta sync is blocked or verification fails
- **THEN** archive MUST NOT move the change directory

#### Scenario: No delta specs

- **WHEN** a change has no delta specs
- **THEN** archive MAY proceed and MUST record that no delta specs were synced

### Requirement: Agent navigation map

The repository SHALL provide a root `AGENTS.md` that maps source capabilities to specs and lists verify/security commands as reference only, without per-change workflow mandates. `AGENTS.md` SHALL stay at or under 150 lines.

#### Scenario: Module map present

- **WHEN** an agent opens `AGENTS.md`
- **THEN** it can locate capability directories under `src/` and their corresponding `openspec/specs/` paths

### Requirement: Distilled React and UI skills

The project SHALL provide thin on-demand skills under `.cursor/skills/` for SPA composition, SPA performance, and UI review, without vendoring full third-party skill packs.

#### Scenario: Skills discoverable

- **WHEN** an agent needs React composition, SPA performance, or UI review guidance
- **THEN** project skills `react-composition`, `react-perf-spa`, and `ui-review` are available under `.cursor/skills/`

### Requirement: Design review gate

After `design.md` is written, the parent agent SHALL launch `openspec-design-reviewer` and obtain `pass` before finalizing tasks for apply.

#### Scenario: Design reviewer required

- **WHEN** design.md for a change is completed
- **THEN** `openspec-design-reviewer` MUST return pass before apply proceeds on that design

### Requirement: Deterministic security gates in CI

CI SHALL run dependency audit suitable for blocking high severity issues and CodeQL analysis for JavaScript/TypeScript on pull requests and the default branch.

#### Scenario: Audit in checks

- **WHEN** the checks workflow runs
- **THEN** it executes the project's `pnpm audit:ci` script

#### Scenario: CodeQL on PR

- **WHEN** a pull request targets the default branch
- **THEN** CodeQL analysis for JavaScript/TypeScript runs

### Requirement: Conditional Security Review for high-risk changes

When a change touches the security surface (File System Access, workers/postMessage, blob URLs, CSP/headers, dependency bumps, or export), apply/archive guidance SHALL require a Cursor Security Review subagent pass before archive.

#### Scenario: High-risk archive gate

- **WHEN** a change is security-tagged or modifies the security surface listed above
- **THEN** archive MUST NOT complete until Security Review has returned without open critical/high findings

#### Scenario: Low-risk skip

- **WHEN** a change does not touch that security surface
- **THEN** Security Review is not required

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

The repository SHALL provide `docs/future-architecture.md` describing the target product architecture for the photobook editor, including product shape, shared geometry/painters, the 60 fps performance model, storage boundaries, image pipeline, print, static site, publishing decisions, rejected or deferred alternatives, and deferred visual-regression e2e with a link to the tracking GitHub issue when one exists. The doc SHALL state that pieces land only through OpenSpec changes listed in `docs/roadmap.md`, not via drive-by implementation. `AGENTS.md` SHALL link to this doc for navigation.

#### Scenario: Future-architecture doc present

- **WHEN** an agent opens `docs/future-architecture.md`
- **THEN** it can find target architecture guidance (including the 60 fps performance model and deferred visual-regression notes) and a pointer that implementation follows `docs/roadmap.md`

#### Scenario: AGENTS links future architecture

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to `docs/future-architecture.md`

### Requirement: Product roadmap

The repository SHALL provide `docs/roadmap.md` as the execution plan for the photobook editor: milestone groupings, top-level checkboxes each naming one OpenSpec change, and guidance that 60 fps is part of done for feature work. `AGENTS.md` SHALL link to this doc for navigation. `openspec/config.yaml` context Doc budget SHALL mention `docs/roadmap.md` alongside other durable docs.

#### Scenario: Roadmap doc present

- **WHEN** an agent opens `docs/roadmap.md`
- **THEN** the file exists and lists milestone-ordered OpenSpec change checkboxes including a first M1 prep item for frame-budget gates

#### Scenario: AGENTS links roadmap

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to `docs/roadmap.md`

#### Scenario: Config context mentions roadmap

- **WHEN** an agent loads project context from `openspec/config.yaml`
- **THEN** the Doc budget text mentions `docs/roadmap.md`

### Requirement: Scrollport success criteria and Playwright lock-in

When an OpenSpec change introduces or changes an in-app scrollport (`overflow: auto` or `scroll` region), proposal success criteria SHALL state that the document MUST NOT gain page-level horizontal or vertical scroll, and that scrolling MUST occur only inside the named scrollport(s). Apply guidance and the quality bar SHALL require Playwright assertions that the document element fits the viewport (and that the named scrollport overflows when content is longer than the viewport), using shared e2e helpers — not `ui-review` as a gate, and not element `scrollLeft` alone as proof of page containment.

#### Scenario: Proposal names scrollport containment

- **WHEN** a proposal's scope includes introducing or changing an in-app scrollport
- **THEN** its success criteria MUST include no page-level H/V scroll and scrolling only inside the named scrollport(s)

#### Scenario: Playwright page-fit helpers are mandated

- **WHEN** such a change is applied
- **THEN** the change MUST include Playwright coverage that asserts `document.documentElement` scroll size does not exceed client size, via shared helpers under `e2e/`, before apply is treated as complete

#### Scenario: Page overflow is not a ui-review gate

- **WHEN** an agent loads OpenSpec quality-bar or apply guidance from `openspec/config.yaml`
- **THEN** the returned text states that page overflow containment is a Playwright invariant and MUST NOT treat skill `ui-review` as the sole gate for that page-overflow invariant

### Requirement: UI browser smoke before push

When an OpenSpec change includes UI in scope, apply SHALL NOT be treated as complete (and SHALL NOT push/archive) until evidenced browser smoke covers empty state, happy path of the change, and primary scroll/interact, and skill `ui-review` (including layout smoke) has been applied. Observable UX claims in success criteria (packing, aspect silhouette, empty copy readability, viewport fill, object-fit, etc.) MUST have matching Playwright assertions before apply completes. Virtualized or variable-size lists MUST assert mounted-window coverage of the scrollport mid-scroll when more items remain — fixed item counts or LoAF alone are insufficient. Green typecheck/unit verify alone is not apply-complete for UI scope.

#### Scenario: Verification checklist names UI smoke

- **WHEN** an agent creates `tasks.md` for a change
- **THEN** the Verification checklist MUST include a UI-in-scope browser smoke item (empty + happy + primary scroll/interact; skill `ui-review`)

#### Scenario: Apply guidance blocks push without smoke

- **WHEN** an agent loads apply guidance from `openspec/config.yaml`
- **THEN** the guidance MUST require evidenced UI browser smoke and `ui-review` before push/archive when UI is in scope

#### Scenario: Implementation reviewer fails missing UI smoke

- **WHEN** `openspec-implementation-reviewer` reviews a UI-scoped change lacking empty/happy/scroll e2e or layout smoke evidence
- **THEN** the verdict MUST NOT be `pass` (missing coverage is high / revise)
