# Spec Delta

## ADDED Requirements

### Requirement: Single OpenSpec planning review

After proposal, design, tasks, and specs (when not skipped) are written, the parent SHALL obtain one `openspec-planning-reviewer` pass before apply. Separate proposal/design reviewer launches are not required on the unattended happy path. Implementation review stays mandatory.

#### Scenario: One planning review after all artifacts

- **WHEN** proposal, design, and tasks for a change are written
- **THEN** the parent launches `openspec-planning-reviewer` once and MUST obtain pass before apply, without requiring separate proposal and design reviewer passes

#### Scenario: Docs-only skips design checklist

- **WHEN** a change has no `design.md`
- **THEN** planning review MUST NOT require design-checklist items and still covers applicable proposal/tasks rules

#### Scenario: Brief is a file path

- **WHEN** the parent briefs the planning reviewer
- **THEN** it writes the brief with `pnpm agent review-brief --out <file>` and passes that path plus the reviewer skill set, not the full parent preamble

#### Scenario: At most one delta re-review

- **WHEN** planning review returns revise and the parent fixes artifacts
- **THEN** at most one further planning re-review is allowed before apply

### Requirement: Compact agent run card

`pnpm agent preflight` SHALL print a compact run card (per ready artifact: template, rules, ≤10-line apply/archive procedure). `pnpm agent instructions <artifact>` SHALL return that artifact's template and rules on demand.

#### Scenario: Preflight prints per-artifact card

- **WHEN** an agent runs `pnpm agent preflight` (text or `--json`)
- **THEN** the report includes, for ready artifacts, template and rules plus a ≤10-line apply/archive procedure

#### Scenario: On-demand instructions

- **WHEN** an agent runs `pnpm agent instructions <artifact> --change <slug>`
- **THEN** the command prints that artifact's template and rules without a raw `openspec instructions` shell or a raw read of `openspec/config.yaml`

### Requirement: Headless OpenSpec read denies

`.cursor/cli.json` SHALL deny raw reads of `openspec instructions`, `openspec/config.yaml`, `.cursor/skills/openspec-*`, and `.cursor/agents/*`. Existing denies that protect main, hooks, or secrets MUST NOT be weakened.

#### Scenario: cli.json deny adds only

- **WHEN** this change updates `.cursor/cli.json`
- **THEN** it only adds deny patterns for the listed OpenSpec/agent paths and does not remove or loosen existing denies

### Requirement: Exploration output limits

`AGENTS.md` and the preflight run card SHALL state exploration defaults: scoped grep ≤30 results, offset/limit reads for files over 400 lines, no re-read of an unchanged file, no TodoWrite in unattended `-p` runs, and Task call shape (skill set + brief file path).

#### Scenario: Defaults documented

- **WHEN** an agent opens `AGENTS.md` or the preflight run card
- **THEN** those exploration and Task-shape defaults are present

### Requirement: Agent stats thresholds

`pnpm agent stats <path>` SHALL accept JSON/JSONL rounds or SQLite `store.db` with the same rounds payload, print per-round input/output/cache-read/model-calls and peak context, and exit 1 when peak context >300000 or first-round input >400000. Invalid rounds MUST exit non-zero.

#### Scenario: Prints per-round metrics

- **WHEN** an agent runs `pnpm agent stats` on a valid rounds document
- **THEN** output includes per-round input, output, cache read, model calls, and the peak context value

#### Scenario: Fails over 300K peak

- **WHEN** peak context in the document is greater than 300000
- **THEN** the command exits 1

#### Scenario: Fails over 400K first-round input

- **WHEN** the first round's input is greater than 400000
- **THEN** the command exits 1

## REMOVED Requirements

### Requirement: Design review gate

Superseded by **Single OpenSpec planning review**. The unattended happy path no longer requires launching `openspec-design-reviewer` immediately after `design.md`.
