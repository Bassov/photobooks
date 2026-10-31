## MODIFIED Requirements

### Requirement: Cover text and book size readouts match the kit

A new book's cover text SHALL be its title on the front, spine and back; the canvas SHALL draw the back text bottom-left on the back panel. Spine width SHALL be computed, not stored: 8 mm + 0.2 mm per page, the page count (2 × spreads) clamped to 20–120 first; the Cover inspector SHALL show it as read-only text "`N` mm", and the canvas spine and the cover card SHALL use it (a stored `spineWidthMm` is ignored). Book settings SHALL show Pages as an editable number box (no spin arrows) with the range hint "20–120": a committed value (Enter or blur) SHALL round to the nearest even number, clamp to 20–120 and add empty spreads at the end or remove the last spreads until 2 × spreads equals it, as one undo step. The note SHALL read "Add N spread(s) to reach the 20-page minimum" below 20, "Remove N spreads to stay within 120 pages" above 120, else "Pages are added in spreads of 2"; the subtitle SHALL read "`back || front || Untitled book` · applies to the whole book".

#### Scenario: New book

- **WHEN** a book "Lake trip" with 3 spreads is created
- **THEN** the back text field and canvas read "Lake trip", Spine width reads "12 mm", and Pages shows "6" · "20–120" with "Add 7 spreads to reach the 20-page minimum"

#### Scenario: Typed page count

- **WHEN** Pages is set to 10, then 200, then 33
- **THEN** the book has 10, then 60, then 17 spreads, Pages shows 20, 120, 34, and Spine width reads 12, 32, 14.8 mm
