# Spec Delta

## ADDED Requirements

### Requirement: Agents must not weaken quality gates

Agents SHALL NOT weaken a quality gate for any reason, including stabilizing a test. There SHALL be no `Stryker disable` until `stryker-diff-gate` defines a budget. Agents SHALL fix failures with code, tests, or a new test seam. `openspec/config.yaml` quality bar, `docs/lessons.md`, and a navigation line in `AGENTS.md` SHALL state this rule.

#### Scenario: Quality bar forbids gate weakening

- **WHEN** an agent loads project context or quality-bar text from `openspec/config.yaml`
- **THEN** the returned text forbids widening exclusions, inline ignore/disable, lowering thresholds, removing checks, loosening assertions or tolerances, retries/`skip`/`fixme`/`test.fail`, and deleting tests or helpers, for any reason, and states that no `Stryker disable` is allowed until `stryker-diff-gate` defines a budget

#### Scenario: Loosening an e2e assertion to stabilize a test is gate weakening

- **WHEN** an agent loosens an e2e assertion or tolerance, or replaces a strict containment check with a weaker overlap check, to stabilize a flaky test
- **THEN** that change MUST be treated as forbidden gate weakening; the agent MUST fix with app code or a deterministic wait, or schedule a roadmap item, and MUST NOT land the looser assertion

#### Scenario: Lessons and AGENTS carry the non-weaken rule

- **WHEN** an agent reads `docs/lessons.md` and root `AGENTS.md`
- **THEN** lessons extend the existing tsconfig/ESLint non-weaken rule to coverage/mutation/thresholds/assertions/retries and forbid `Stryker disable` until `stryker-diff-gate` defines a budget, and AGENTS has a single navigation line pointing agents at that mandate without a checklist

#### Scenario: Red CI is not fixed by gate config

- **WHEN** a PR check is red and `git-finish` guidance applies
- **THEN** the agent MUST fix with code and tests only and MUST NOT weaken gate configuration or assertions to turn the check green

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

`openspec-implementation-reviewer` SHALL treat as high a quality-gate config edit that is missing from the touch-set, has no stated reason, or makes any gate less strict (lower thresholds, higher budgets, more retries, new exclusions, removed checks, looser assertions). A listed edit that is strictly stricter is not a finding. Any other config edit outside the design touch-set is high. Excluding from coverage or mutation a production file that the same diff modifies is critical.

#### Scenario: Gate edit outside touch-set is high

- **WHEN** implementation review finds a gate-file or other config edit not listed in the design touch-set
- **THEN** the finding severity MUST be at least high

#### Scenario: Listed stricter gate edit is not blocking

- **WHEN** implementation review finds a quality-gate config edit that is listed in the touch-set with a reason and is strictly stricter
- **THEN** that edit MUST NOT be reported as a blocking finding

#### Scenario: Same-diff exclusion is critical

- **WHEN** the same change both modifies a production file and adds or widens an exclusion that removes that file from coverage or mutation
- **THEN** the finding severity MUST be critical

## MODIFIED Requirements

### Requirement: Unattended roadmap item flow

The project SHALL provide `/next-roadmap-item` to run one open roadmap item (`pnpm roadmap next`) end to end without editing CLI-generated `opsx-*` or `openspec-*` files. Mandates stay in `openspec/config.yaml` and `.cursor/rules/git-finish.mdc`. Security-tagged or security-surface items continue and MUST pass Security Review before archive. Until ratchet or dependency-policy items merge, gate-config and dependency rules in the command scenarios apply.

#### Scenario: Command exists and points at SoT

- **WHEN** an agent opens `.cursor/commands/next-roadmap-item.md`
- **THEN** the command describes the end-to-end stages and references `openspec/config.yaml`, `git-finish.mdc` and skill `roadmap` as mandate sources without restating their full checklists

#### Scenario: Security-tagged item continues to Security Review

- **WHEN** the selected roadmap item is tagged `(Security Review: …)` or touches the security surface
- **THEN** the unattended flow MUST continue (it MUST NOT stop solely for that reason) and MUST complete Security Review before archive

#### Scenario: Gate-config edit before ratchet lands

- **WHEN** the selected item edits a quality-gate config and `gate-ratchet`/`gate-ratchet-ci` are not yet merged
- **THEN** the edit MUST be strictly stricter and listed in the touch-set with a reason, or the run MUST stop

#### Scenario: New dependency before dependency-policy lands

- **WHEN** the change adds or changes a dependency and `dependency-policy` is not yet merged
- **THEN** apply MUST include `pnpm audit:ci` evidence and a Security Review pass before archive

#### Scenario: Item selection skips blocked work

- **WHEN** the command picks the next roadmap item
- **THEN** it runs `pnpm roadmap next --skip <slugs with an open PR or remote branch>`, which skips those slugs and `[contingency]` items, and the run stops at a milestone review cut reported by `done`

#### Scenario: Defined stop conditions only

- **WHEN** the unattended run encounters a dirty working tree, a milestone review cut, intent that conflicts with a spec or open issue, three red CI fix rounds, or a PR that conflicts with `main`
- **THEN** the run MUST stop and ask; otherwise it MUST continue through archive, PR, and green CI

### Requirement: Change sizing budget

Each OpenSpec change SHALL fit one agent apply context: at most one new subsystem and at most 8 implementation tasks in `tasks.md` (excluding Verification). Line-count target/max and subsystem definition live in `docs/roadmap/RULES.md` Change size. `openspec/config.yaml` SHALL carry the subsystem/task limits and `pnpm roadmap add --after` growth rule, pointing to RULES.md for line counts. RULES.md SHALL include deferred review findings as next items.

#### Scenario: Budget is loadable from OpenSpec instructions

- **WHEN** an agent runs `openspec instructions proposal` or `openspec instructions tasks`
- **THEN** the returned rules state the one-subsystem limit, the 8-task limit, and point to `docs/roadmap/RULES.md` for the line-count target/max

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
