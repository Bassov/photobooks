## MODIFIED Requirements

### Requirement: Shared performance budgets

The system SHALL expose one shared budget configuration used by scenario tests, local perf runs, and benches. Budgets MUST include: zero LoAF entries during a scenario window; hot-handler p95 ≤ 2 ms; INP ≤ 100 ms; frame pacing p95 ≤ 16.7 ms with dropped frames ≤ 2%. The repository MUST NOT reintroduce a 200 ms LoAF allowance.

#### Scenario: Budgets are the single source of truth

- **WHEN** a scenario test or local perf run asserts LoAF, INP, handler timing, or frame pacing
- **THEN** it reads thresholds from the shared budgets module rather than hard-coding local numbers, and LoAF is asserted as zero entries (no 200 ms allowance)
