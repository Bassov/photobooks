## ADDED Requirements

### Requirement: Scrollport success criteria and Playwright lock-in

When an OpenSpec change introduces or changes an in-app scrollport (`overflow: auto` or `scroll` region), proposal success criteria SHALL state that the document MUST NOT gain page-level horizontal or vertical scroll, and that scrolling MUST occur only inside the named scrollport(s). Apply guidance and the quality bar SHALL require Playwright assertions that the document element fits the viewport (and that the named scrollport overflows when content is longer than the viewport), using shared e2e helpers — not `ui-review` as a gate, and not element `scrollLeft` alone as proof of page containment.

#### Scenario: Proposal names scrollport containment

- **WHEN** a proposal's scope includes introducing or changing an in-app scrollport
- **THEN** its success criteria MUST include no page-level H/V scroll and scrolling only inside the named scrollport(s)

#### Scenario: Playwright page-fit helpers are mandated

- **WHEN** such a change is applied
- **THEN** the change MUST include Playwright coverage that asserts `document.documentElement` scroll size does not exceed client size, via shared helpers under `e2e/`, before apply is treated as complete

#### Scenario: Page overflow is not a ui-review gate

- **WHEN** an agent loads OpenSpec quality-bar or apply guidance from `openspec/config.yaml`
- **THEN** the returned text states that page overflow containment is a Playwright invariant and MUST NOT treat optional skill `ui-review` as the gate for that invariant
