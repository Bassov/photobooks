## MODIFIED Requirements

### Requirement: Stack spacing and page labels

The gap between consecutive spreads on the pasteboard (bottom edge to next top edge) SHALL be a fixed fraction of the spread height, 72 / 588 (wider than the kit `#/demo` 44 / 588 by design), at every committed zoom including the smallest reachable zoom, so the gap looks the same relative to the pages. Each page number SHALL sit a constant 8 screen px under its own page's bottom edge with an 11 px font that does not scale with zoom, including during a live zoom gesture, and is hidden while the gap is shorter than 19 px (8 px + the 11 px line). The page shadow SHALL be the kit `--page-shadow` in screen px at every zoom and live gesture, painted outside the zoom-scaled world so it never scales or jumps, tracking each page edge within 1 px, and never clipped into a hard band. The zoom-out floor SHALL be the lower of 0.25 × Fit and the whole-stack fit, but spreads MUST NOT get shorter than 16 px; a book too long to fit at 16 px scrolls. At that 16 px floor every spread MUST be mounted (whole-book overview). A single page (page 1, a single last page) SHALL have its number centred under it; a two-page spread centres each number under its page. Window spacers, reveal, the zoom-out floor and zoom anchoring MUST use the same stride.

#### Scenario: Gap scales with zoom

- **WHEN** the user zooms in or out and the zoom commits, down to the smallest reachable zoom
- **THEN** the gap divided by the spread height is unchanged (within 2%) and the spread under the pointer keeps its screen position

#### Scenario: Long book at the floor

- **WHEN** a 40-spread book is zoomed out to the floor
- **THEN** the gap keeps the same ratio to the spread height, the stack fits or scrolls, and every spread is mounted

#### Scenario: Shadow and page numbers hold screen px while zooming

- **WHEN** the user zooms to 18 %, Fit or 138 %, or is mid zoom gesture
- **THEN** the page shadow is the kit `--page-shadow` in screen px and every shown number is 8 px under its page, 11 px, centred under it

#### Scenario: Shadow tracks the page through a continuous zoom

- **WHEN** the user Ctrl+wheel zooms several steps in and back out
- **THEN** after every step each shadow box matches its page rect within 1 px and its computed shadow is unchanged
