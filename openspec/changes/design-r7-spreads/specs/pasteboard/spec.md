## MODIFIED Requirements

### Requirement: Stack spacing and page labels

The gap between consecutive spreads on the pasteboard (bottom edge to next top edge) SHALL be a fixed fraction of the spread height, 104 / 588 (Owner design change, round 7: wider than the kit `#/demo` 44 / 588 so the page numbers and the new-spread pill have room), at every committed zoom including the smallest reachable zoom, so the gap looks the same relative to the pages. Each page number SHALL sit a constant 8 screen px under its own page's bottom edge with an 11 px font that does not scale with zoom, including during a live zoom gesture. Designer-accepted deviation (2026-10-31): page numbers are hidden when the gap cannot hold 8 px + 11 px label — whenever the gap in screen px (at rest, or the layout gap times the live gesture scale) is shorter than 19 px — and shown otherwise; a number is either exactly 8 px / 11 px at full opacity or not rendered (no fade, transition or position jump). The page shadow SHALL be the kit `--page-shadow` in screen px at every zoom and live gesture, painted outside the zoom-scaled world so it never scales or jumps, tracking each page edge within 1 px, and never clipped into a hard band. The zoom-out floor SHALL be the lower of 0.25 × Fit and the whole-stack fit, but spreads MUST NOT get shorter than 16 px; a book too long to fit at 16 px scrolls. At that 16 px floor every spread MUST be mounted (whole-book overview). In a book of two spreads or more, page 1 and a single last page SHALL each occupy a spread-wide slot with the page on its own half (page 1 right, last page left) and no paper on the other half, on the canvas and in the spread list (kit `#/demo`); the spread list labels them `1` and the last page number, and middle spreads `a–b`. A single page SHALL have its number centred under it; a two-page spread centres each number under its page. While a filmstrip photo is dragged, each gap SHALL show the "Drop here for a new spread" pill on one line at a constant screen size (32 px tall, 12 px text, 8 px radius at every zoom), centred in the gap, never intersecting a page number; it SHALL be hidden (not faded) whenever the gap in screen px is shorter than the pill plus 19 px label clearance above and below (70 px). Window spacers, reveal, the zoom-out floor and zoom anchoring MUST use the same stride.

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

#### Scenario: Page numbers at the zoom floor

- **WHEN** the stack is at the zoom floor (gap about 16 px), or a wheel zoom passes through gaps under 19 px
- **THEN** no page number is shown there, and every number shown at any step is 8 px under its page at 11 px and opacity 1

#### Scenario: Single pages on their side

- **WHEN** a 19 × 23 book is open at Fit (1440 × 900)
- **THEN** page 1 is the right half of its 848 px slot and the last page the left half, each 424 × 513.25, and their list cards show the page on the same half of the spread-wide card

#### Scenario: New-spread pill in the gap

- **WHEN** a filmstrip photo is dragged at Fit, at 300 % and at a low zoom that still holds the pill
- **THEN** the pill has the same one-line rect size at each zoom, is centred in its gap within 0.5 px and intersects no page number; below the 70 px gap it is not shown
