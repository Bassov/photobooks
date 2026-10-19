## ADDED Requirements

### Requirement: Repeat findings become checks

When a review finding repeats, the same change MUST turn it into an automated check (lint rule, test, shared helper, or a `verify` / `pnpm check` script). Only if a check is not feasible, add a SHALL to the owning area spec and/or a short code-site comment. Global invariants live only in the `openspec/config.yaml` quality bar. A findings journal MUST NOT exist outside archives.

#### Scenario: Config states repeat-to-check

- **WHEN** an agent loads OpenSpec quality bar or apply guidance from `openspec/config.yaml`
- **THEN** the guidance requires converting a repeated finding into a check (or area SHALL / code comment when a check is infeasible) and does not require reading or appending a findings journal

#### Scenario: Journal paths are absent

- **WHEN** an agent searches the repository for the retired findings-journal paths
- **THEN** those paths do not exist outside archives

#### Scenario: AGENTS has no findings-journal navigation

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it does not find a navigation link to a findings journal

## REMOVED Requirements

### Requirement: Lessons journal for agents

**Reason:** Dissolved into repeat-finding → check (#78 / `lessons-dissolve`).
**Migration:** Use **Repeat findings become checks**; quality bar and area specs hold durable rules.

### Requirement: Conflict-free lessons entries

**Reason:** Journal removed; no append path remains.
**Migration:** Parallel agents add checks or area SHALLs in their own files instead of journal entries.

## MODIFIED Requirements

### Requirement: Agents must not weaken quality gates

Agents SHALL NOT weaken a quality gate for any reason, including stabilizing a test. The only allowed inline mutation suppression is the budgeted next-line form `// Stryker disable next-line <Mutator>[,…]: <reason>` (reason ≥ 10 characters) within `mutation.disableBudget` and the per-file cap; all other `Stryker disable` forms are forbidden. A one-line note in `tasks.md` SHALL NOT justify leaving a survivor. Agents SHALL fix failures with code, tests, a new test seam, or that budgeted next-line form. Mechanical owners for ratchet / weakening / disable budget are the roadmap items `gate-ratchet`, `gate-weakening-guard`, and `stryker-disable-budget`. Same-change product-logic Stryker exclude widening is owned by `stryker-diff-gate` / `exclusions-registry`. `openspec/config.yaml` quality bar and a navigation line in `AGENTS.md` SHALL state the non-weaken rule (no findings journal).

#### Scenario: Quality bar forbids gate weakening

- **WHEN** an agent loads project context or quality-bar text from `openspec/config.yaml`
- **THEN** the returned text forbids widening exclusions, illegal inline ignore/disable, lowering thresholds, removing checks, loosening assertions or tolerances, retries/`skip`/`fixme`/`test.fail`, and deleting tests or helpers, for any reason, and allows only the budgeted next-line Stryker disable form within the configured budget

#### Scenario: tasks.md reason does not excuse a survivor

- **WHEN** a mutant survives and the only justification is a free-text reason in `tasks.md` without a budgeted next-line disable (or dead-code deletion)
- **THEN** implementation review and apply operations treat that as insufficient; the agent MUST delete the dead code or use the legal next-line form within budget

#### Scenario: Loosening an e2e assertion to stabilize a test is gate weakening

- **WHEN** an agent loosens an e2e assertion or tolerance, or replaces a strict containment check with a weaker overlap check, to stabilize a flaky test
- **THEN** that change MUST be treated as forbidden gate weakening; the agent MUST fix with app code or a deterministic wait, or schedule a roadmap item, and MUST NOT land the looser assertion

#### Scenario: Quality bar and AGENTS carry the non-weaken rule

- **WHEN** an agent reads `openspec/config.yaml` quality bar and root `AGENTS.md`
- **THEN** the quality bar states the non-weaken rule including the budgeted next-line Stryker disable form, and AGENTS has a single navigation line pointing at that mandate without a checklist or findings journal

#### Scenario: Red CI is not fixed by gate config

- **WHEN** a PR check is red and `git-finish` guidance applies
- **THEN** the agent MUST fix with code and tests only and MUST NOT weaken gate configuration or assertions to turn the check green

### Requirement: Auto-merge trivial main conflicts on finish

When a feature PR conflicts with `main`, git-finish / `pnpm agent finish` SHALL fetch and merge `origin/main`. It MAY auto-resolve only (1) `docs/roadmap.md` hunks where both sides purely ADD distinct whole lines relative to the merge base (parallel `roadmap add`), keeping both added lines, and (2) `pnpm-lock.yaml` via `pnpm install` when `package.json` itself has no conflict. After an auto-resolution it MUST run `pnpm -s roadmap check` before committing the merge; a failed check is treated as a semantic conflict. Any other conflict (item files, RULES/INTRO, modified or deleted base lines, `package.json`) MUST leave the merge in progress (or abort it), MUST NOT commit, and MUST fail with a message listing the files and instructing to resolve per `git-finish.mdc` then run finish again. Deterministic verify after the merge SHALL run exactly once via pre-push `pnpm check` on the subsequent push (finish MUST NOT run a separate full verify before that push), and MUST NOT rebase or force-push.

#### Scenario: Pure-add index conflict merges

- **WHEN** finish detects a conflict with `main` that is only pure-add lines in `docs/roadmap.md` (and/or a lockfile clash without `package.json` conflict)
- **THEN** it merges, auto-resolves, runs `roadmap check`, commits the merge, and relies on pre-push `pnpm check` for the deterministic suite on push without stopping for a human

#### Scenario: Modified-line or item-file conflict stops

- **WHEN** finish encounters a modified-line conflict in `docs/roadmap.md`, any conflict under an item file, or other non-allowlisted paths
- **THEN** it leaves the merge unresolved, does not commit, and reports with guidance to resolve per `git-finish.mdc` then run finish again

#### Scenario: Semantic conflict stops

- **WHEN** finish encounters overlapping semantic code conflicts
- **THEN** it stops and reports without force-push or rebase
