## ADDED Requirements

### Requirement: Write-tests skill asserts concrete e2e outcomes

The project `write-tests` skill SHALL require Playwright e2e for placement, swap, and move flows to assert concrete per-frame outcomes (at least `data-asset-id`, and `src` or equivalent visible asset identity) rather than only counts of placed items or status-string presence.

#### Scenario: Skill forbids count-only swap asserts

- **WHEN** an agent authors or rewrites a swap or move Playwright test using the `write-tests` skill
- **THEN** the skill text requires asserting which asset occupies which frame, not only filmstrip/frame counts

#### Scenario: Skill is discoverable

- **WHEN** an agent needs Vitest or Playwright authorship guidance
- **THEN** project skill `write-tests` is available under `.cursor/skills/`
