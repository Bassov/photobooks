## MODIFIED Requirements

### Requirement: Page number folios

A parent's page numbers SHALL be two derived items `${parentId}-pn-l` / `-pn-r` (20 × 4.34 mm, `y = min(H − bottom/2 − 2.17, H − safe − 4.34)`, x per position Outer / Centre / Inner from the parent's effective margins, kept inside the safe area); the position SHALL read back from the left item's align. `setParentPageNumbers` (position or `null`) and `setPageNumbering` (start clamped 1–999, skipFirst, format) SHALL be undoable ops, and trim or grid edits SHALL re-derive the items. Page `p` (spread `⌊p/2⌋`, even → left) SHALL print `start + p − 1` in decimal or roman, and no folio when the side does not exist, the parent has no item for it, the spread hides that id, or `skipFirst` and `p` = 1. `resolveSpread` SHALL return the spread's `folios {id, text, rectMm, align}` (omitted when none) in spread mm. The painter SHALL draw each folio in the parent layer after the parent frames and under every spread frame (canvas, Preview, site; never in list thumbnails) at its rect, Inter 3.1 mm × px/mm, not hit-testable; the Masters canvas SHALL mark each item with a `#` chip; the master inspector SHALL offer Show and (when on) Outer / Centre / Inner, and Book settings SHALL offer Start at, format and Skip first page.

#### Scenario: Outer folios on an A5 master

- **WHEN** a parent on an A5 book with 15 mm margins and a 5 mm safe area gets `setParentPageNumbers` `outer`
- **THEN** the left item is at x 15, y 200.33 mm aligned left, and the right item ends 15 mm from the spread's right edge aligned right

#### Scenario: Moving a spread renumbers

- **WHEN** a spread is moved to another index
- **THEN** its resolved folios read the numbers of the pages it now sits on, and no stored item changes

#### Scenario: Show on paints every page

- **WHEN** Show is turned on for the master every spread uses
- **THEN** each existing page shows its number at the folio box, a full-bleed spread frame covers it, and the spread list thumbnails show none
