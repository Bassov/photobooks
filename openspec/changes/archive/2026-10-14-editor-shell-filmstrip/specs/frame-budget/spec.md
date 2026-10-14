## MODIFIED Requirements

### Requirement: CI proxy gates under CPU throttling

Automated Playwright interaction scenarios in CI MUST run with CDP CPU throttling calibrated for shared runners. Those scenarios MUST hard-fail when any LoAF entry is recorded during the scenario window, when INP exceeds the shared budget, or when measured hot-handler p95 exceeds the shared budget. Frame-pacing statistics MUST be published as a non-blocking CI artifact for the same scenarios.

#### Scenario: Photo import scenario fails on LoAF

- **WHEN** a throttled CI scenario imports photos through the gallery filmstrip flow (bulk import while scrolling) and at least one LoAF entry is recorded during the scenario window
- **THEN** the scenario fails

#### Scenario: Filmstrip bulk import scenario fails on LoAF

- **WHEN** a throttled CI scenario imports ~200 photos into the filmstrip while scrolling and at least one LoAF entry is recorded during the scenario window
- **THEN** the scenario fails

#### Scenario: Frame pacing is report-only in CI

- **WHEN** a throttled CI scenario completes
- **THEN** frame-pacing statistics are attached as an artifact and do not by themselves fail the job when outside local hard thresholds

### Requirement: Local frame-pacing command

The project SHALL provide a `pnpm perf` command that runs the same interaction scenarios on a real machine and MUST hard-fail when frame-pacing statistics violate the shared budgets (p95 frame ≤ 16.7 ms, dropped frames ≤ 2%).

#### Scenario: Local perf asserts frame pacing

- **WHEN** an operator runs `pnpm perf` against a Chromium build of the app
- **THEN** scenarios that exceed the shared frame-pacing budgets fail the command
