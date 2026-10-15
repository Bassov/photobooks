# Spec Delta

## MODIFIED Requirements

### Requirement: Active spread template and add spread

The editor SHALL offer a keyboard-reachable control that sets the active spread's template to full-bleed, one-per-page, 2-up, or 4-grid, and a keyboard-reachable control that appends a spread. The template control MUST show the active spread's current template. The appended spread MUST use the one-per-page template and MUST be brought into the pasteboard scrollport after it is laid out. Appending a spread MUST keep the committed zoom and the previous spread's scale. These controls MUST NOT create page-level horizontal or vertical scroll.

#### Scenario: Switch the active spread to 4-grid

- **WHEN** the user chooses 4-grid for the active spread
- **THEN** that spread shows four empty frame placeholders and every other spread keeps its previous frame count

#### Scenario: Add spread enters the pasteboard

- **WHEN** the user adds a spread
- **THEN** the pasteboard spread count increases by one, the new spread uses one-per-page, and that spread lies within the pasteboard scrollport

#### Scenario: Add spread keeps the fitted zoom

- **WHEN** the user chooses fit spread, notes the zoom percent and the previous last spread's on-screen height, then adds a spread
- **THEN** the zoom percent is unchanged, that previous spread keeps the same on-screen height while becoming two pages wide, the new one-page spread lies within the pasteboard scrollport, and the document element does not gain horizontal or vertical page scroll

#### Scenario: Template controls do not scroll the page

- **WHEN** the template control and the add-spread control are visible
- **THEN** the document element does not gain horizontal or vertical page scroll
