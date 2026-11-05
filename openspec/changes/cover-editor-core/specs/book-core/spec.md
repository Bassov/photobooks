## MODIFIED Requirements

### Requirement: Cover text and book size readouts match the kit

A new book's cover text SHALL be its title on the front, spine and back; the canvas SHALL draw the back text bottom-left on the back panel. The page count SHALL be the pages the Spreads list shows: a single page 1, two pages per inner spread and a single last page (2 × (spreads − 1); 0 or 1 below two spreads); the top bar, Book settings, library caption, spine and site meta SHALL all use it. Spine width SHALL be computed by the book's print profile (generic: 8 mm + 0.2 mm per page, the page count clamped to the profile's 20–120 first), not stored; the Cover inspector SHALL show it as read-only text "`N` mm", and the canvas spine and the cover card SHALL use it (a stored `spineWidthMm` is used only when the cover's spine source is `manual` and the profile allows a manual override). Book settings SHALL show Pages as an editable number box (no spin arrows) with the range hint "20–120": a committed value (Enter or blur) SHALL round to the nearest even number, clamp to 20–120 and add empty spreads at the end or remove the last spreads until the page count equals it, as one undo step. The note SHALL read "Add N spread(s) to reach the 20-page minimum" below 20, "Remove N spreads to stay within 120 pages" above 120, else "Pages are added in spreads of 2"; the subtitle SHALL read "`back || front || Untitled book` · applies to the whole book".

#### Scenario: New book

- **WHEN** a book "Lake trip" with 3 spreads is created
- **THEN** the back text field and canvas read "Lake trip", Spine width reads "12 mm", and Pages shows "4" · "20–120" with "Add 8 spreads to reach the 20-page minimum"

#### Scenario: Typed page count

- **WHEN** Pages is set to 10, then 200, then 33
- **THEN** the book has 11, then 61, then 18 spreads, Pages shows 20, 120, 34, the Spreads list ends at that page, and Spine width reads 12, 32, 14.8 mm

### Requirement: Printer profile data

A printer profile SHALL parse with Zod and carry trim and page-bleed ranges, cover bleed, cover wrap and hinge widths, safe margin, page count `{min, step, max}` (`max - min` a multiple of `step`), single first page, printed endpapers, spine (`formula` base + per page, or a `table` ascending by page count; manual override allowed or not), `output` `pages` | `spreads`, crop marks (default off), color space `srgb`, file limits, DPI `warn` ≥ `min`, and minimum font size. Low-DPI checks SHALL use the book's effective profile thresholds; the built-in `generic` profile and an unknown profile id use 200 / 150. The `generic` profile SHALL have wrap 15 mm, hinge 8 mm and spine `8 + 0.2 mm/page`. A pure cover geometry SHALL take the spine from the profile rule at the page count clamped to the profile range (formula rounded to 0.1 mm; table: first row covering the count, else the last row) and SHALL give the printed cover sheet `(2 × trim width + spine + 2 × wrap) × (trim height + 2 × wrap)` with the back, spine, front, hinge and safe-frame rects; an unknown profile id uses `generic`.

#### Scenario: Profile thresholds drive the low-DPI level

- **WHEN** a frame's effective DPI is 180 and the profile's DPI is `{ warn: 200, min: 150 }`
- **THEN** the frame reports `warn`, and with `{ warn: 300, min: 200 }` it reports `min`

#### Scenario: Generic cover sheet

- **WHEN** a 19 × 23 cm book with 20 pages uses the `generic` profile
- **THEN** the spine is 12 mm and the cover sheet is 422 × 260 mm (32 mm spine, 442 mm wide at 120 pages)
