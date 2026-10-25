# frame-budget Specification

## Purpose

Defines how Photobooks measures and gates main-thread responsiveness for interaction scenarios: shared budgets, in-page perf hooks, CI proxy gates under CPU throttling, and local frame-pacing checks.

## Requirements

### Requirement: Shared performance budgets

The system SHALL expose one shared budget configuration used by scenario tests, local perf runs, and benches. Budgets MUST include: zero LoAF entries during a scenario window; hot-handler p95 ≤ 2 ms; INP ≤ 100 ms; frame pacing p95 ≤ 16.7 ms with dropped frames ≤ 2%. The repository MUST NOT reintroduce a 200 ms LoAF allowance.

#### Scenario: Budgets are the single source of truth

- **WHEN** a scenario test or local perf run asserts LoAF, INP, handler timing, or frame pacing
- **THEN** it reads thresholds from the shared budgets module rather than hard-coding local numbers, and LoAF is asserted as zero entries (no 200 ms allowance)

### Requirement: In-page performance hooks

When performance hooks are enabled (development builds or an explicit `perf` / legacy `loaf` query flag), the system MUST observe LoAF, sample rAF frame pacing, observe Event Timing for INP, and expose helpers to clear entries, read measurements, wrap hot handlers with `performance.measure`, and assert against shared budgets via `window.__photobooksPerf`.

#### Scenario: Hooks available for a scenario window

- **WHEN** the app is loaded with performance hooks enabled
- **THEN** `window.__photobooksPerf` is defined and can clear measurements, report LoAF / INP / frame stats, and assert budgets for an interaction scenario

### Requirement: CI proxy gates under CPU throttling

Automated Playwright interaction scenarios in CI MUST run with CDP CPU throttling calibrated for shared runners. Those scenarios MUST hard-fail when any LoAF entry is recorded during the scenario window, when INP exceeds the shared budget, or when measured hot-handler p95 exceeds the shared budget. Frame-pacing statistics MUST be published as a non-blocking CI artifact for the same scenarios. Dual-lane decode scheduling, cancel-on-scroll, and dual-tier WebP encode MUST NOT relax these thresholds or how LoAF entries are counted.

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

A throttled Playwright scenario MUST zoom the painter fixture continuously from the whole book to 400% of physical size and back, including working-preview swaps after the gesture settles and the remount of newly visible spreads through zoom-out gesture end, and MUST fail when any long-animation-frame entry is recorded or when the wheel-zoom handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets. The scenario MUST NOT require a tier larger than the working preview (1280).

#### Scenario: Whole-book zoom fails on a long animation frame

- **WHEN** a throttled scenario zooms the painter fixture from the whole book to 400% and back, working-preview swaps included, and records at least one long animation frame during that zoom
- **THEN** the scenario fails

#### Scenario: Wheel zoom fails when the handler is slow

- **WHEN** a throttled scenario zooms the painter fixture and the wheel-zoom handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes continuous zoom

- **WHEN** an operator runs `pnpm perf`
- **THEN** the continuous zoom scenario runs and the command fails when frame pacing exceeds the shared budgets

#### Scenario: Working preview is inside the zoom window

- **WHEN** a throttled scenario zooms the painter fixture to 400% and the gesture has settled
- **THEN** a filled frame shows the working preview (1280) during that scenario window when available, and the scenario still fails if a long animation frame was recorded

#### Scenario: Zoom-out settle remount is inside the LoAF window

- **WHEN** a throttled scenario runs a continuous zoom-out burst through the default settle, waits until the zoom gesture has ended, and waits until paced remount of newly visible spreads completes
- **THEN** the scenario fails if any long animation frame was recorded during that burst-through-paced-remount window

### Requirement: Gallery drag stays within frame budget

A throttled Playwright scenario MUST drag across the zoomed-out painter fixture and MUST fail when any long-animation-frame entry is recorded or when the dragover handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Zoomed-out drag fails on a long animation frame

- **WHEN** a throttled scenario drags across the zoomed-out painter fixture and records at least one long animation frame during that drag
- **THEN** the scenario fails

#### Scenario: Dragover fails when the handler is slow

- **WHEN** a throttled scenario drags across the zoomed-out painter fixture and the dragover handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes gallery drag

- **WHEN** an operator runs `pnpm perf`
- **THEN** the zoomed-out gallery drag scenario runs and the command fails when frame pacing exceeds the shared budgets

### Requirement: Frame drag stays within frame budget

A throttled Playwright scenario MUST drag a frame across the zoomed-out painter fixture and MUST fail when any long-animation-frame entry is recorded or when the dragover handler p95 exceeds the shared budget. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Zoomed-out frame drag fails on a long animation frame

- **WHEN** a throttled scenario drags a frame across the zoomed-out painter fixture and records at least one long animation frame during that drag
- **THEN** the scenario fails

#### Scenario: Frame dragover fails when the handler is slow

- **WHEN** a throttled scenario drags a frame across the zoomed-out painter fixture and the dragover handler p95 exceeds the shared budget
- **THEN** the scenario fails

#### Scenario: Local perf includes frame drag

- **WHEN** an operator runs `pnpm perf`
- **THEN** the zoomed-out frame drag scenario runs and the command fails when frame pacing exceeds the shared budgets

### Requirement: Save during drag stays within frame budget

A throttled Playwright scenario MUST trigger a library-backed book save while a drag gesture is active across the zoomed-out painter fixture (or an equivalent active drag), and MUST fail when any long-animation-frame entry is recorded during that window. Serialization MUST run at background priority so it does not block the drag path. The `pnpm perf` command MUST run the same scenario and MUST fail when frame pacing exceeds the shared budgets.

#### Scenario: Save during drag fails on a long animation frame

- **WHEN** a throttled scenario starts a drag, triggers save for a library-backed book during that drag, and records at least one long animation frame during that window
- **THEN** the scenario fails

#### Scenario: Local perf includes save during drag

- **WHEN** an operator runs `pnpm perf`
- **THEN** the save-during-drag scenario runs and the command fails when frame pacing exceeds the shared budgets

### Requirement: Autosave during continuous drag stays within frame budget

A throttled Playwright scenario MUST keep a continuous drag active while a dirty library-backed book would fire autosave debounce, and MUST fail on any long-animation-frame entry. Autosave MUST NOT start during the gesture; serialization MUST use background priority when idle. `pnpm perf` MUST run the same scenario and fail when frame pacing exceeds shared budgets.

#### Scenario: Continuous drag with pending autosave fails on a long animation frame

- **WHEN** a throttled scenario dirties a library-backed book, starts a continuous drag that spans the autosave debounce window, and records at least one long animation frame during that window
- **THEN** the scenario fails

#### Scenario: Local perf includes autosave-during-drag

- **WHEN** a developer runs `pnpm perf`
- **THEN** the autosave-during-drag scenario runs and the command fails when frame pacing exceeds the shared budgets

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
