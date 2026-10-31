## MODIFIED Requirements

### Requirement: Active spread template and add spread

The editor SHALL offer keyboard-reachable controls to set the active spread’s template (full-bleed, one-per-page, 2-up, 4-grid) and to add a spread (the spreads-list row menu Add after, or Ctrl/Cmd+Enter on a row). The template control MUST show the active spread’s current template. The template control’s accessible name MUST state that it applies to the active spread. The added spread MUST use the template of the spread that was active when it was added, or one-per-page when none is active, and MUST enter the pasteboard scrollport after layout (including after fit when one axis still overflows). Adding a spread MUST keep the committed zoom and the previous spread’s scale. Controls MUST NOT create page-level H/V scroll.

#### Scenario: Switch the active spread to 4-grid

- **WHEN** the user chooses 4-grid for the active spread
- **THEN** that spread shows four empty frame placeholders and every other spread keeps its previous frame count

#### Scenario: Add spread enters the pasteboard

- **WHEN** the user adds a spread while the active spread uses a catalog template
- **THEN** the pasteboard spread count increases by one, the new spread uses that same template, and that spread lies within the pasteboard scrollport

#### Scenario: Add spread with no active spread uses one-per-page

- **WHEN** the user adds a spread and no spread is active
- **THEN** the new spread uses one-per-page

#### Scenario: Add spread keeps fitted zoom and contains after fit

- **WHEN** the user adds a spread after fit (including narrow viewport or mid-scroll desktop)
- **THEN** zoom and previous-spread scale hold, the new spread is in the pasteboard port, and the document has no page scroll

## ADDED Requirements

### Requirement: Stack spacing and page labels

Consecutive spreads on the pasteboard SHALL be 44 screen px apart (bottom edge to next top edge) at every committed zoom where a spread is at least 88 px tall; page numbers sit 6 px under the spread inside that gap. Below 88 px (zoomed out past the kit's 0.25 × Fit floor) the gap MUST be half the spread height, so whole-stack fit still shows every spread. A single page (page 1, a single last page) SHALL have its number centred under it; a two-page spread centres each number under its page. Window spacers, reveal, the whole-stack zoom floor and zoom anchoring MUST use the same stride.

#### Scenario: Gap holds after zoom

- **WHEN** the user zooms in or out and the zoom commits
- **THEN** the gap between consecutive spreads is still 44 px and the spread under the pointer keeps its screen position

#### Scenario: Whole book still fits

- **WHEN** a 40-spread book is zoomed out to the floor
- **THEN** the whole stack fits the port and every spread is mounted
