## MODIFIED Requirements

### Requirement: Agents must not weaken quality gates

Agents SHALL NOT weaken a quality gate for any reason, including stabilizing a test. The only allowed inline mutation suppression is the budgeted next-line form `// Stryker disable next-line <Mutator>[,…]: <reason>` (reason ≥ 10 characters) within `mutation.disableBudget` and the per-file cap; all other `Stryker disable` forms are forbidden. A one-line note in `tasks.md` SHALL NOT justify leaving a survivor. Agents SHALL fix failures with code, tests, a new test seam, or that budgeted next-line form. `openspec/config.yaml` quality bar, `docs/lessons.md`, and a navigation line in `AGENTS.md` SHALL state this rule.

#### Scenario: Quality bar forbids gate weakening

- **WHEN** an agent loads project context or quality-bar text from `openspec/config.yaml`
- **THEN** the returned text forbids widening exclusions, illegal inline ignore/disable, lowering thresholds, removing checks, loosening assertions or tolerances, retries/`skip`/`fixme`/`test.fail`, and deleting tests or helpers, for any reason, and allows only the budgeted next-line Stryker disable form within the configured budget

#### Scenario: tasks.md reason does not excuse a survivor

- **WHEN** a mutant survives and the only justification is a free-text reason in `tasks.md` without a budgeted next-line disable (or dead-code deletion)
- **THEN** implementation review and apply operations treat that as insufficient; the agent MUST delete the dead code or use the legal next-line form within budget

#### Scenario: Loosening an e2e assertion to stabilize a test is gate weakening

- **WHEN** an agent loosens an e2e assertion or tolerance, or replaces a strict containment check with a weaker overlap check, to stabilize a flaky test
- **THEN** that change MUST be treated as forbidden gate weakening; the agent MUST fix with app code or a deterministic wait, or schedule a roadmap item, and MUST NOT land the looser assertion

#### Scenario: Lessons and AGENTS carry the non-weaken rule

- **WHEN** an agent reads `docs/lessons.md` and root `AGENTS.md`
- **THEN** lessons extend the existing tsconfig/ESLint non-weaken rule to coverage/mutation/thresholds/assertions/retries and state the budgeted next-line Stryker disable rule, and AGENTS has a single navigation line pointing agents at that mandate without a checklist

#### Scenario: Red CI is not fixed by gate config

- **WHEN** a PR check is red and `git-finish` guidance applies
- **THEN** the agent MUST fix with code and tests only and MUST NOT weaken gate configuration or assertions to turn the check green
