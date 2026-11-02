## MODIFIED Requirements

### Requirement: CI proxy gates under CPU throttling

Automated Playwright interaction scenarios in CI MUST run with CDP CPU throttling calibrated for shared runners. Those scenarios MUST hard-fail when any LoAF entry with blockingDuration > 20 ms, or more than one blocking entry, is recorded during the scenario window, when INP exceeds the shared budget, or when measured hot-handler p95 exceeds the shared budget. Thumb fling scenarios (filmstrip fling over warming, hydrating or hot thumbs) MUST NOT count entries with blockingDuration ≤ 5 ms, whatever their source; they still fail on any entry > 20 ms or on two or more entries > 5 ms. Frame-pacing statistics MUST be published as a non-blocking CI artifact for the same scenarios. Outside the thumb fling exemption above, dual-lane decode scheduling, cancel-on-scroll, and dual-tier WebP encode MUST NOT relax these thresholds or how LoAF entries are counted.

#### Scenario: Photo import scenario fails on LoAF

- **WHEN** a throttled CI scenario imports photos through the gallery filmstrip flow (bulk import while scrolling) and at least one LoAF entry is recorded during the scenario window
- **THEN** the scenario fails

#### Scenario: Filmstrip bulk import scenario fails on LoAF

- **WHEN** a throttled CI scenario imports ~200 photos into the filmstrip while scrolling and at least one LoAF entry is recorded during the scenario window
- **THEN** the scenario fails

#### Scenario: Thumb fling ignores short LoAF

- **WHEN** a thumb fling scenario window records only entries blocking ≤ 5 ms, plus at most one entry blocking 5–20 ms
- **THEN** the scenario passes; a second entry > 5 ms or any entry > 20 ms fails it

#### Scenario: Frame pacing is report-only in CI

- **WHEN** a throttled CI scenario completes
- **THEN** frame-pacing statistics are attached as an artifact and do not by themselves fail the job when outside local hard thresholds
