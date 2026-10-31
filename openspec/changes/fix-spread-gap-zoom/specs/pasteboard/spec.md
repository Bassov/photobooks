## MODIFIED Requirements

### Requirement: Stack spacing and page labels

The gap between consecutive spreads on the pasteboard (bottom edge to next top edge) SHALL be a fixed fraction of the spread height, 44 / 588 (kit `#/demo`: 44 px under its 588 px Fit spread at 1440×900), at every committed zoom including the smallest reachable zoom, so the gap looks the same relative to the pages. Page numbers sit 6 px under the spread inside that gap and are hidden while the gap is shorter than 22 px. The zoom-out floor SHALL be the lower of 0.25 × Fit and the whole-stack fit, but spreads MUST NOT get shorter than 16 px; a book too long to fit at 16 px scrolls. At that 16 px floor every spread MUST be mounted (whole-book overview). A single page (page 1, a single last page) SHALL have its number centred under it; a two-page spread centres each number under its page. Window spacers, reveal, the zoom-out floor and zoom anchoring MUST use the same stride.

#### Scenario: Gap scales with zoom

- **WHEN** the user zooms in or out and the zoom commits, down to the smallest reachable zoom
- **THEN** the gap divided by the spread height is unchanged (within 2%) and the spread under the pointer keeps its screen position

#### Scenario: Long book at the floor

- **WHEN** a 40-spread book is zoomed out to the floor
- **THEN** the gap keeps the same ratio to the spread height, the stack fits or scrolls, and every spread is mounted
