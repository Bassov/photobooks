# Spec Delta

## ADDED Requirements

### Requirement: Continuous zoom stays within frame budget

A throttled Playwright scenario MUST zoom the painter fixture continuously from the whole book to 400% of physical size and back, and MUST fail when any long-animation-frame entry is recorded or when the wheel-zoom handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Whole-book zoom fails on a long animation frame

- **WHEN** a throttled scenario zooms the painter fixture from the whole book to 400% and back and records at least one long animation frame during that zoom
- **THEN** the scenario fails

#### Scenario: Wheel zoom fails when the handler is slow

- **WHEN** a throttled scenario zooms the painter fixture and the wheel-zoom handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes continuous zoom

- **WHEN** an operator runs `pnpm perf`
- **THEN** the continuous zoom scenario runs and the command fails when frame pacing exceeds the shared budgets
