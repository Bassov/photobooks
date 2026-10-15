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

### Requirement: Pasteboard scroll stays within frame budget

A throttled Playwright scenario MUST scroll the painter-fixture pasteboard from top to bottom and MUST fail when any long-animation-frame entry is recorded during that scroll. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Fixture pasteboard scroll fails on a long animation frame

- **WHEN** a throttled scenario loads the painter fixture, scrolls the pasteboard from top to bottom, and records at least one long animation frame during that scroll
- **THEN** the scenario fails

#### Scenario: Local perf includes pasteboard scroll

- **WHEN** an operator runs `pnpm perf`
- **THEN** the pasteboard scroll scenario runs and the command fails when frame pacing exceeds the shared budgets

### Requirement: Template switch and add spread stay within frame budget

A throttled Playwright scenario MUST switch the active spread's template and add a spread, and MUST fail when any long-animation-frame entry is recorded during that interaction. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Template switch and add spread fail on a long animation frame

- **WHEN** a throttled scenario switches the active spread's template, adds a spread, and records at least one long animation frame during that interaction
- **THEN** the scenario fails

#### Scenario: Local perf includes template switch and add spread

- **WHEN** an operator runs `pnpm perf`
- **THEN** the template switch and add-spread scenario runs and the command fails when frame pacing exceeds the shared budgets

### Requirement: Continuous zoom stays within frame budget

A throttled Playwright scenario MUST zoom the painter fixture continuously from the whole book to 400% of physical size and back, including zoom-tier switches after the gesture settles, and MUST fail when any long-animation-frame entry is recorded or when the wheel-zoom handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Whole-book zoom fails on a long animation frame

- **WHEN** a throttled scenario zooms the painter fixture from the whole book to 400% and back, tier switches included, and records at least one long animation frame during that zoom
- **THEN** the scenario fails

#### Scenario: Wheel zoom fails when the handler is slow

- **WHEN** a throttled scenario zooms the painter fixture and the wheel-zoom handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes continuous zoom

- **WHEN** an operator runs `pnpm perf`
- **THEN** the continuous zoom scenario runs and the command fails when frame pacing exceeds the shared budgets

#### Scenario: Tier switch is inside the zoom window

- **WHEN** a throttled scenario zooms the painter fixture to 400% and the gesture has settled
- **THEN** a filled frame's tier changes during that scenario window and the scenario still fails if a long animation frame was recorded
