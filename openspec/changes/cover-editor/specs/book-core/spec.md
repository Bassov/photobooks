## MODIFIED Requirements

### Requirement: Cover text and book size readouts match the kit

A new book's cover text SHALL be its title on the front, spine and back; the canvas SHALL draw the back text bottom-left on the back panel. The page count SHALL be the pages the Spreads list shows: a single page 1, two pages per inner spread and a single last page (2 × (spreads − 1); 0 or 1 below two spreads); the top bar, Book settings, library caption, spine and site meta SHALL all use it. Spine width SHALL be computed by the book's print profile (generic: 8 mm + 0.2 mm per page, the page count clamped to the profile's 20–120 first), not stored; the Cover inspector SHALL show it as read-only text "`N` mm", and the canvas spine and the cover card SHALL use it (a stored `spineWidthMm` is used only when the cover's spine source is `manual` and the profile allows a manual override). Book settings SHALL show Pages as an editable number box (no spin arrows) with the range hint "20–120": a committed value (Enter or blur) SHALL round to the nearest even number, clamp to 20–120 and add empty spreads at the end or remove the last spreads until the page count equals it, as one undo step. The note SHALL read "Add N spread(s) to reach the 20-page minimum" below 20, "Remove N spreads to stay within 120 pages" above 120, else "Pages are added in spreads of 2"; the subtitle SHALL read "`back || front || Untitled book` · applies to the whole book".
The cover canvas SHALL fit the printed cover sheet (closed cover plus the profile wrap on all four sides) and draw the band veiled, hatched hinge strips beside the spine, a dashed safe frame per board and a "Wrap `N` mm" chip only while the band is at least 18 screen px; the spine text SHALL be centred on the spine on the canvas and mini covers. A photo dropped on the front board or its wrap band SHALL set the cover photo; drops on the back board or the spine SHALL not. The Cover inspector sub SHALL read "Hardcover · wrap `W` mm · hinge `H` mm" with the hint "`profile` print profile · `N` pages" under Spine width (", printed as `min`" below the profile minimum; no hint for a manual spine). A page count change SHALL re-render only the cover views.

#### Scenario: New book

- **WHEN** a book "Lake trip" with 3 spreads is created
- **THEN** the back text field and canvas read "Lake trip", Spine width reads "12 mm", and Pages shows "4" · "20–120" with "Add 8 spreads to reach the 20-page minimum"

#### Scenario: Typed page count

- **WHEN** Pages is set to 10, then 200, then 33
- **THEN** the book has 11, then 61, then 18 spreads, Pages shows 20, 120, 34, the Spreads list ends at that page, and Spine width reads 12, 32, 14.8 mm

#### Scenario: Cover sheet follows the page count

- **WHEN** a 19 × 23 cm book at Fit (1440 × 900) has 20, then 60, then 120 pages
- **THEN** the canvas spine is 24.11, 39.44, 61.39 px wide, the spine text centre is within 0.5 px of the spine centre, and a photo dropped on the front's wrap band becomes the cover photo
