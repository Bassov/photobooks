# frame-budget Specification

## Purpose

Defines how Photobooks measures and gates main-thread responsiveness for interaction scenarios: shared budgets, in-page perf hooks, CI proxy gates under CPU throttling, and local frame-pacing checks.

## Requirements

### Requirement: Shared performance budgets

The system SHALL expose one shared budget configuration used by scenario tests, local perf runs, and benches. Budgets MUST include: zero LoAF entries during a scenario window; hot-handler p95 ≤ 2 ms; INP ≤ 100 ms; frame pacing p95 ≤ 16.7 ms with dropped frames ≤ 2%.

#### Scenario: Budgets are the single source of truth

- **WHEN** a scenario test or local perf run asserts LoAF, INP, handler timing, or frame pacing
- **THEN** the thresholds come from the shared budget configuration rather than hard-coded literals scattered across suites

### Requirement: In-page performance hooks

When performance hooks are enabled (development builds or an explicit `perf` / legacy `loaf` query flag), the system MUST observe LoAF, sample rAF frame pacing, observe Event Timing for INP, and expose helpers to clear entries, read measurements, wrap hot handlers with `performance.measure`, and assert against shared budgets via `window.__photobooksPerf`.

#### Scenario: Hooks available for a scenario window

- **WHEN** the app is loaded with performance hooks enabled
- **THEN** `window.__photobooksPerf` is defined and can clear measurements, report LoAF / INP / frame stats, and assert budgets for an interaction scenario

### Requirement: CI proxy gates under CPU throttling

Automated Playwright interaction scenarios in CI MUST run with CDP CPU throttling calibrated for shared runners. Those scenarios MUST hard-fail when any LoAF entry is recorded during the scenario window, when INP exceeds the shared budget, or when measured hot-handler p95 exceeds the shared budget. Frame-pacing statistics MUST be published as a non-blocking CI artifact for the same scenarios.

#### Scenario: Photo import scenario fails on LoAF

- **WHEN** a throttled CI scenario imports a ~24MP JPEG through the photo-card flow and at least one LoAF entry is recorded during the scenario window
- **THEN** the scenario fails

#### Scenario: Frame pacing is report-only in CI

- **WHEN** a throttled CI scenario completes
- **THEN** frame-pacing statistics are attached as an artifact and do not by themselves fail the job when outside local hard thresholds

### Requirement: Local frame-pacing command

The project SHALL provide a `pnpm perf` command that runs the same interaction scenarios on a real machine and MUST hard-fail when frame-pacing statistics violate the shared budgets (p95 frame ≤ 16.7 ms, dropped frames ≤ 2%).

#### Scenario: Local perf asserts frame pacing

- **WHEN** an operator runs `pnpm perf` against a Chromium build of the app
- **THEN** scenarios that exceed the shared frame-pacing budgets fail the command
