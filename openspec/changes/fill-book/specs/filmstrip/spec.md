## ADDED Requirements

### Requirement: Fill book from the filmstrip head

The dock head SHALL show a "Fill book" chip first in its right group (also without Add folder…). It is disabled with a `title` reason (no photos, Masters mode, every photo placed, every unplaced file missing). Its popover SHALL show the core `planFillBook` numbers for the unplaced, non-missing photos in the filmstrip sort; Enter confirms one `fillBook` step ("Fill book"), makes the first changed spread active with no frame selected, reveals it without a zoom change and shows the fill status; Esc / Cancel / outside change nothing.

#### Scenario: Fill a new book with 12 photos

- **WHEN** a new 4-page book has 12 unplaced photos and the user opens Fill book and presses Enter
- **THEN** the popover read "4 photos" / "8 photos · 4 spreads" / "4 → 12", the book has 7 spreads, the status reads "Placed 12 photos · added 4 spreads" and one Ctrl+Z restores the 3 spreads
