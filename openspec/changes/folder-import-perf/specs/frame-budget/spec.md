## ADDED Requirements

### Requirement: Large folder scan stays responsive

The shared performance budgets MUST remain the single source of truth and MUST NOT be weakened. In addition, a large-folder import / re-scan harness (memory or FSA test doubles with on the order of 3,000–4,000 small images) MUST assert that the main thread stays responsive during scan: no long task longer than ~100 ms attributable to the scan/import scheduler, or an equivalent input/rAF responsiveness probe. The same harness MUST assert that used-in-book prioritized entries finish before lazy unused remainder work. The check MUST integrate with existing unit/perf tooling (`pnpm check:fast` / `pnpm perf` inventory as appropriate) without replacing or relaxing LoAF-zero CI interaction gates.

#### Scenario: Synthetic large folder keeps long tasks bounded

- **WHEN** the large-folder responsiveness harness runs against ~3,000–4,000 synthetic small images
- **THEN** it fails if a scan/import scheduler long task exceeds the ~100 ms responsiveness ceiling (or the equivalent probe fails)

#### Scenario: Used-in-book completes before lazy remainder

- **WHEN** the large-folder harness marks a subset of files as used-in-book and runs prioritized re-scan
- **THEN** those used-in-book files complete verify/re-hash before idle processing of the unused remainder starts

#### Scenario: Existing budgets stay intact

- **WHEN** shared `PERF_BUDGETS` or LoAF-zero CI scenarios are evaluated after this change
- **THEN** LoAF entries max remains 0, handler p95 ≤ 2 ms, and INP ≤ 100 ms with no raised allowances
