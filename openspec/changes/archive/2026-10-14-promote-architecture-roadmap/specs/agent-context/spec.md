## MODIFIED Requirements

### Requirement: Future architecture notes

The repository SHALL provide `docs/future-architecture.md` describing the target product architecture for the photobook editor, including product shape, shared geometry/painters, the 60 fps performance model, storage boundaries, image pipeline, print, static site, publishing decisions, rejected or deferred alternatives, and deferred visual-regression e2e with a link to the tracking GitHub issue when one exists. The doc SHALL state that pieces land only through OpenSpec changes listed in `docs/roadmap.md`, not via drive-by implementation. `AGENTS.md` SHALL link to this doc for navigation.

#### Scenario: Future-architecture doc present

- **WHEN** an agent opens `docs/future-architecture.md`
- **THEN** it can find target architecture guidance (including the 60 fps performance model and deferred visual-regression notes) and a pointer that implementation follows `docs/roadmap.md`

#### Scenario: AGENTS links future architecture

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to `docs/future-architecture.md`

## ADDED Requirements

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
