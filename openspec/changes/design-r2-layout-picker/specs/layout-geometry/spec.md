## MODIFIED Requirements

### Requirement: Layout templates on the grid

The system SHALL provide a template catalog — full-bleed, one-per-page, 2-up, 4-grid, two-portraits, landscape-two-portraits, hero-two, hero-grid, panorama, three-across, framed-single, offset-pair, and contact sheets `contact-CxR` (C 1..5, R 1..4) — each generating frames in millimeters. Spread coordinates originate at the top-left trim corner. Effective layout grid is the spread override when present, otherwise the book-level grid. Applying a template SHALL replace frames, set `templateId`, rebind `assetId`/crop by frame index order, preserve existing frame ids by index (mint only for extras; drop unused ids), and use these layouts: full-bleed is one frame from `(-bleed,-bleed)` sized to spread width/height plus twice bleed on each axis; one-per-page is one margin-inset frame per page (left/right halves on two-page spreads); 2-up is two equal columns in the whole-spread margin-inset box separated by the column gutter; 4-grid is a 2×2 grid in that same box using column and row gutters; two-portraits is a centered 3:4 frame per page on two-page spreads (two side by side on one-page spreads); landscape-two-portraits is a 3:2 landscape frame in the left page box and two 3:4 frames side by side in the right page box (top half / bottom half on one-page spreads); a contact sheet is a C×R grid per page in that page's margin-inset box using column and row gutters, page by page, row-major. The kit layouts use the left / right halves (the page content boxes on two-page spreads; the content box split by the column gutter on one-page spreads): hero-two is the left half plus the right half split into two rows by the row gutter; hero-grid is the left half plus a 2×2 grid in the right half; panorama is a centered 7:2 frame in the whole-spread content box; three-across is three centered squares in three gutter-separated columns of that box; framed-single is the right half; offset-pair is the top 70% of the left half and the bottom 70% of the right half.

#### Scenario: Full-bleed covers trim plus bleed

- **WHEN** the full-bleed template is applied to a spread with bleed B and spread width W and height H
- **THEN** the spread has one frame with rect `{ x: -B, y: -B, width: W + 2B, height: H + 2B }`

#### Scenario: One-per-page on a two-page spread

- **WHEN** one-per-page is applied to an interior (two-page) spread
- **THEN** the spread has exactly two frames, each margin-inset within its page half

#### Scenario: 2-up uses whole-spread columns

- **WHEN** 2-up is applied to a two-page spread
- **THEN** the spread has exactly two frames as equal columns across the whole margin-inset content area (not one frame per page)

#### Scenario: Template switch keeps photos by index

- **WHEN** a spread with placed assets applies a different catalog template
- **THEN** frames receive prior placements by ascending index until one side is exhausted

#### Scenario: 4-grid aligns to margins and gutters

- **WHEN** the 4-grid template is applied
- **THEN** four frames fill the margin-inset content area as a 2×2 grid using column and row gutters from the effective layout grid

#### Scenario: Contact sheet fits the margins

- **WHEN** `contact-3x4` is applied to a two-page spread
- **THEN** the spread has 24 frames, all inside the page margin boxes and non-overlapping

#### Scenario: Kit layouts stay inside the margins

- **WHEN** hero-two, hero-grid, panorama, three-across, framed-single or offset-pair is applied to a one- or two-page spread
- **THEN** the spread has 3, 5, 1, 3, 1 or 2 frames respectively, all inside the margin-inset content area and non-overlapping
