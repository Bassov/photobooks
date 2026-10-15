## ADDED Requirements

### Requirement: Unattended roadmap item flow

The project SHALL provide a Cursor command `/next-roadmap-item` that runs one unchecked top-level `docs/roadmap.md` item end to end in a single session without editing CLI-generated `opsx-*` or `openspec-*` files. Per-change mandates remain in `openspec/config.yaml`; per-PR and CI-wait mandates remain in `.cursor/rules/git-finish.mdc`.

#### Scenario: Command exists and points at SoT

- **WHEN** an agent opens `.cursor/commands/next-roadmap-item.md`
- **THEN** the command describes the end-to-end stages and references `openspec/config.yaml` and `git-finish.mdc` as mandate sources without restating their full checklists

#### Scenario: Security-tagged item stops the run

- **WHEN** the selected roadmap item is security-tagged or touches the security surface
- **THEN** the unattended flow MUST stop and ask before apply/archive rather than inventing a missing security-reviewer agent

#### Scenario: Item selection skips blocked work

- **WHEN** the command picks the next roadmap item
- **THEN** it selects the first top-level unchecked item, skips items with an open PR or remote branch, skips `[contingency]` items whose gate has not failed, and stops at a milestone review cut

#### Scenario: Defined stop conditions only

- **WHEN** the unattended run encounters a dirty working tree, a milestone review cut, a security-tagged item, intent that conflicts with a spec or open issue, three red CI fix rounds, or a PR that conflicts with `main`
- **THEN** the run MUST stop and ask; otherwise it MUST continue through archive, PR, and green CI

### Requirement: Manual check before archive

After implementation review passes and before archive, changes SHALL run a Manual check and record numbered steps and observed results under `## Manual test scenarios` in `tasks.md`. That section SHALL be the source for the PR section of the same name.

#### Scenario: Verification checklist names Manual check

- **WHEN** an agent creates `tasks.md` for a change
- **THEN** the Verification checklist MUST include a Manual check item that runs after implementation review pass and before archive

#### Scenario: Archive blocked without Manual check

- **WHEN** archive is requested while the Manual check checklist item is unchecked
- **THEN** archive MUST NOT proceed

#### Scenario: Manual check drives Browser check or records N/A

- **WHEN** Manual check runs for a roadmap `[feature]` or UI-scoped change
- **THEN** the agent drives the app through the item's Browser check (or spec scenarios for `[prep]`) and records results; non-UI changes MAY record N/A

#### Scenario: Bug found in Manual check

- **WHEN** Manual check finds a product bug
- **THEN** the change MUST add a Playwright test, fix the bug, and re-run implementation review on the delta before archive

### Requirement: Docs/rules sync

When a change alters behavior, commands, CI output, the module map, or the roadmap item, apply SHALL keep README, AGENTS (≤150 lines, no checklists), affected rules/skills, future-architecture notes, and roadmap annotations aligned with what shipped. Agents MUST NOT add an alwaysApply rule without merging or removing another.

#### Scenario: Verification checklist names Docs/rules sync

- **WHEN** an agent creates `tasks.md` for a change
- **THEN** the Verification checklist MUST include a Docs/rules sync item naming those update targets

#### Scenario: Archive blocked without Docs/rules sync

- **WHEN** archive is requested while the Docs/rules sync checklist item is unchecked
- **THEN** archive MUST NOT proceed

#### Scenario: Implementation reviewer fails stale docs

- **WHEN** `openspec-implementation-reviewer` reviews a change whose diff contradicts README, AGENTS, rules, or future-architecture, or overstates the roadmap item
- **THEN** a stale contradicted statement is at least medium, and a roadmap line that overstates what shipped is high

## MODIFIED Requirements

### Requirement: Archive always syncs delta specs

When a change has delta specs, archive SHALL sync those deltas into main `openspec/specs/` and verify the merge before moving the change. Archive MUST NOT skip-sync while delta specs exist. After the move, archive SHALL tick the matching top-level `docs/roadmap.md` checkbox on the same branch when the change maps to one, and SHALL tick a related `[contingency]` closed as not needed with its gate owner.

#### Scenario: Delta specs require sync before archive

- **WHEN** a completed change has one or more delta spec files and archive is requested
- **THEN** the agent syncs deltas to main specs, verifies the merge, and only then archives the change

#### Scenario: Sync blocked stops archive

- **WHEN** delta sync is blocked or verification fails
- **THEN** archive MUST NOT move the change directory

#### Scenario: No delta specs

- **WHEN** a change has no delta specs
- **THEN** archive MAY proceed and MUST record that no delta specs were synced

#### Scenario: Roadmap tick after archive move

- **WHEN** a completed change that maps to a top-level roadmap checkbox is archived
- **THEN** that checkbox is marked done in `docs/roadmap.md` on the same branch after the archive move

#### Scenario: Contingency closed with gate owner

- **WHEN** a gate-owning change archives with its gate green and a related `[contingency]` is not needed
- **THEN** that contingency checkbox is ticked together with the gate-owning item

#### Scenario: Drift grep before archive move

- **WHEN** archive is about to move the change
- **THEN** the agent greps README, AGENTS, `.cursor/rules`, and `docs/` for terms the change touched and fixes drift or notes "No doc changes" next to the Docs/rules sync bullets
