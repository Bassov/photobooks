## ADDED Requirements

### Requirement: Parent edit stays within frame budget

A parent edit MUST invalidate the cached paint of the parent and of the spreads using it only; spreads on another parent or None MUST keep their cached paint. A throttled Playwright scenario MUST nudge a parent item used by all 40 zoomed-out painter fixture spreads in Masters mode and MUST fail when any long-animation-frame entry is recorded or the nudge INP exceeds the shared budget.

#### Scenario: Parent edit keeps unrelated paint cached

- **WHEN** parent A is edited in a book with spreads on A, on parent B and on None
- **THEN** only A and the spreads on A are invalidated and repainted; the B and None spreads keep their cached paint

#### Scenario: Parent nudge fails on a long animation frame

- **WHEN** a throttled scenario nudges a Masters item used by 40 mounted spreads and records at least one long animation frame
- **THEN** the scenario fails
