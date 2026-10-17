# Spec Delta

## ADDED Requirements

### Requirement: Agents must not weaken quality gates

Agents SHALL NOT add or widen coverage or mutation exclusions, add inline ignore or disable comments (except equivalent-mutant disables within the budget defined by `stryker-diff-gate`), lower thresholds, or remove checks to make a gate pass. They SHALL fix failures with code, tests, or a new test seam. `openspec/config.yaml` quality bar, `docs/lessons.md`, and a navigation line in `AGENTS.md` SHALL state this rule.

#### Scenario: Quality bar forbids gate weakening

- **WHEN** an agent loads project context or quality-bar text from `openspec/config.yaml`
- **THEN** the returned text forbids widening exclusions, inline ignore/disable (except equivalent-mutant disables in budget), lowering thresholds, or removing checks to pass a gate

#### Scenario: Lessons and AGENTS carry the non-weaken rule

- **WHEN** an agent reads `docs/lessons.md` and root `AGENTS.md`
- **THEN** lessons extend the existing tsconfig/ESLint non-weaken rule to coverage/mutation/thresholds, and AGENTS has a single navigation line pointing agents at that mandate without a checklist

#### Scenario: Red CI is not fixed by gate config

- **WHEN** a PR check is red and `git-finish` guidance applies
- **THEN** the agent MUST fix with code and tests only and MUST NOT weaken gate configuration to turn the check green

### Requirement: Deferred findings grow the roadmap

When a blocking review finding is deferred, or a change is about to exceed the size budget during propose or apply, the agent SHALL add a new roadmap item with `pnpm roadmap add <slug> --after <current>` (same milestone, scope, Done when) and finish the current change within the budget. Vague follow-ups outside the roadmap are forbidden.

#### Scenario: Over-budget apply grows the roadmap

- **WHEN** planning or apply shows the PR will exceed the size budget
- **THEN** the agent adds overflow via `pnpm roadmap add --after <current>` and keeps the current PR within the limit

#### Scenario: Deferred finding becomes next checkbox

- **WHEN** a blocking reviewer finding is deferred rather than fixed in the current change
- **THEN** it becomes a new roadmap item immediately after the current one via `pnpm roadmap add --after`

### Requirement: Blocking reviewer findings are resolved or scheduled

Blocking (critical or high) findings from `openspec-proposal-reviewer`, `openspec-design-reviewer`, `openspec-implementation-reviewer`, the Security Review subagent, and `adversarial-reviewer` when present SHALL be fixed in the change or turned into roadmap items right after the current item. The PR body SHALL record each reviewer verdict and the disposition of each finding.

#### Scenario: Blocking finding blocks archive until fixed or scheduled

- **WHEN** a listed reviewer returns critical or high findings
- **THEN** archive MUST NOT proceed until each finding is fixed or scheduled as a next roadmap checkbox

#### Scenario: PR records reviewer dispositions

- **WHEN** the agent opens or updates the pull request for the change
- **THEN** the PR body records each reviewer verdict and what happened to each finding

### Requirement: Design touch-set lists gate-file edits

When a design's touch-set includes editing a quality-gate config file (coverage thresholds, mutation config/exclusions, ESLint/tsconfig strictness, CI gate workflows, or equivalent), `openspec/config.yaml` design rules SHALL require each such edit to appear in the touch-set with a reason.

#### Scenario: Gate-file edit needs touch-set reason

- **WHEN** a design proposes editing a quality-gate config file
- **THEN** the touch-set lists that file and states why the edit is required

### Requirement: Implementation reviewer severities for gate edits

`openspec-implementation-reviewer` SHALL treat a gate-file edit, or a config edit outside the design touch-set, as high. It SHALL treat excluding from coverage or mutation a production file that the same diff modifies as critical.

#### Scenario: Gate edit outside touch-set is high

- **WHEN** implementation review finds a gate-file or other config edit not listed in the design touch-set
- **THEN** the finding severity MUST be at least high

#### Scenario: Same-diff exclusion is critical

- **WHEN** the same change both modifies a production file and adds or widens an exclusion that removes that file from coverage or mutation
- **THEN** the finding severity MUST be critical

## MODIFIED Requirements

### Requirement: Unattended roadmap item flow

The project SHALL provide a Cursor command `/next-roadmap-item` that runs one open roadmap item, selected with `pnpm roadmap next`, end to end in a single session without editing CLI-generated `opsx-*` or `openspec-*` files. Per-change mandates remain in `openspec/config.yaml`; per-PR and CI-wait mandates remain in `.cursor/rules/git-finish.mdc`. Security-tagged items SHALL continue through the run and MUST obtain a Security Review pass before archive when the security surface is in scope. Gate-config edits do not stop the run; the ratchet allows only stricter values.

#### Scenario: Command exists and points at SoT

- **WHEN** an agent opens `.cursor/commands/next-roadmap-item.md`
- **THEN** the command describes the end-to-end stages and references `openspec/config.yaml`, `git-finish.mdc` and skill `roadmap` as mandate sources without restating their full checklists

#### Scenario: Security-tagged item stops the run

- **WHEN** the selected roadmap item is security-tagged or touches the security surface
- **THEN** the unattended flow MUST continue (it MUST NOT stop solely for that reason) and MUST complete Security Review before archive when the security surface is in scope

#### Scenario: Item selection skips blocked work

- **WHEN** the command picks the next roadmap item
- **THEN** it runs `pnpm roadmap next --skip <slugs with an open PR or remote branch>`, which skips those slugs and `[contingency]` items, and the run stops at a milestone review cut reported by `done`

#### Scenario: Defined stop conditions only

- **WHEN** the unattended run encounters a dirty working tree, a milestone review cut, intent that conflicts with a spec or open issue, three red CI fix rounds, or a PR that conflicts with `main`
- **THEN** the run MUST stop and ask; otherwise it MUST continue through archive, PR, and green CI

### Requirement: Change sizing budget

Each OpenSpec change SHALL fit one agent apply context: at most one new subsystem, at most 8 implementation tasks in `tasks.md` (excluding the Verification checklist), and a guideline of about 1000 changed lines of source and tests. `openspec/config.yaml` proposal, tasks, and apply rules SHALL carry these limits and the grow-roadmap-via-`pnpm roadmap add --after` rule; the roadmap docs and agent docs SHALL reference them instead of restating them. `docs/roadmap/RULES.md` SHALL define a subsystem with examples and list the slicing rules, including that deferred review findings become items right after the current one.

#### Scenario: Budget is loadable from OpenSpec instructions

- **WHEN** an agent runs `openspec instructions proposal` or `openspec instructions tasks`
- **THEN** the returned rules state the one-subsystem limit, the 8-task limit, and the ~1000-line guideline

#### Scenario: Over-budget change is split before apply

- **WHEN** a proposed change exceeds the budget
- **THEN** the agent narrows its scope and adds the remainder with `pnpm roadmap add <slug> --after <current>` before apply starts

#### Scenario: Roadmap items fit the budget

- **WHEN** an agent reads an open roadmap item (`pnpm roadmap show <slug>`) that has no OpenSpec change yet, in a milestone without a `**Re-plan:**` line
- **THEN** the item names at most one new subsystem, and a `[feature]` that needs both new non-UI infrastructure and a new UI region has that infrastructure in a preceding `[prep]` item

#### Scenario: Risk fallbacks are explicit items

- **WHEN** a roadmap item has a perf or memory gate whose named fallback adds its own scope
- **THEN** the fallback is a separate `[contingency]` item rather than a clause inside the gated item

#### Scenario: Change size docs name growth for deferred findings

- **WHEN** an agent reads `docs/roadmap/RULES.md` Change size
- **THEN** it states that over-budget overflow and deferred review findings are added with `pnpm roadmap add --after`, not as a larger PR or vague follow-up
