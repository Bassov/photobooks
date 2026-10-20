## MODIFIED Requirements

### Requirement: Active spread template and add spread

The editor SHALL offer a keyboard-reachable control that sets the active spread's template to full-bleed, one-per-page, 2-up, or 4-grid, and a keyboard-reachable control that appends a spread. The template control MUST show the active spread's current template. The template control's accessible name MUST state that it applies to the active spread. The appended spread MUST use the template of the spread that was active when Add spread was pressed, or one-per-page when none is active, and MUST be brought fully into the pasteboard scrollport after it is laid out, including after fit-spread or fit-width when the laid-out box fits one axis but still overflows the other. Appending a spread MUST keep the committed zoom and the previous spread's scale. These controls MUST NOT create page-level horizontal or vertical scroll.

#### Scenario: Switch the active spread to 4-grid

- **WHEN** the user chooses 4-grid for the active spread
- **THEN** that spread shows four empty frame placeholders and every other spread keeps its previous frame count

#### Scenario: Add spread enters the pasteboard

- **WHEN** the user adds a spread while the active spread uses a catalog template
- **THEN** the pasteboard spread count increases by one, the new spread uses that same template, and that spread lies within the pasteboard scrollport

#### Scenario: Add spread with no active spread uses one-per-page

- **WHEN** the user adds a spread and no spread is active
- **THEN** the new spread uses one-per-page

#### Scenario: Add spread keeps the fitted zoom

- **WHEN** the user chooses fit spread, notes the zoom percent and the previous last spread's on-screen height, then adds a spread
- **THEN** the zoom percent is unchanged, that previous spread keeps the same on-screen height while becoming two pages wide, the new spread lies within the pasteboard scrollport, and the document element does not gain horizontal or vertical page scroll

#### Scenario: Add spread contains after fit on a narrow viewport

- **WHEN** the viewport is about 400 CSS pixels wide, the user chooses fit spread or fit width, then adds a spread
- **THEN** the new spread lies fully within the pasteboard scrollport and the document element does not gain horizontal page scroll

#### Scenario: Add spread contains after fit from mid-scroll on desktop

- **WHEN** on a desktop-sized viewport the pasteboard is scrolled partway through the stack, the user chooses fit spread or fit width, then adds a spread
- **THEN** the new spread lies fully within the pasteboard scrollport after the reveal and the document element does not gain horizontal page scroll

#### Scenario: Template controls do not scroll the page

- **WHEN** the template control and the add-spread control are visible
- **THEN** the document element does not gain horizontal or vertical page scroll
