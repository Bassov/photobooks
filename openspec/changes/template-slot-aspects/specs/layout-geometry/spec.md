## MODIFIED Requirements

### Requirement: Layout templates on the grid

The system SHALL provide a template catalog — full-bleed, one-per-page, 2-up, 4-grid, two-portraits, landscape-two-portraits, and contact sheets `contact-CxR` (C 1..5, R 1..4) — each generating frames in millimeters. Spread coordinates originate at the top-left trim corner. Effective layout grid is the spread override when present, otherwise the book-level grid. Applying a template SHALL replace frames, set `templateId`, rebind `assetId`/crop by frame index order, preserve existing frame ids by index (mint only for extras; drop unused ids), and use these layouts: full-bleed is one frame from `(-bleed,-bleed)` sized to spread width/height plus twice bleed on each axis; one-per-page is one margin-inset frame per page (left/right halves on two-page spreads); 2-up is two equal columns in the whole-spread margin-inset box separated by the column gutter; 4-grid is a 2×2 grid in that same box using column and row gutters; two-portraits is a centered 3:4 frame per page on two-page spreads (two side by side on one-page spreads); landscape-two-portraits is a 3:2 landscape frame in the left page box and two 3:4 frames side by side in the right page box (top half / bottom half on one-page spreads); a contact sheet is a C×R grid per page in that page's margin-inset box using column and row gutters, page by page, row-major.

#### Scenario: Contact sheet fits the margins

- **WHEN** `contact-3x4` is applied to a two-page spread
- **THEN** the spread has 24 frames, all inside the page margin boxes and non-overlapping

## ADDED Requirements

### Requirement: Slot aspect classes and best template

The system SHALL classify each template slot as portrait, landscape, or square from its frame geometry (square within 5% of 1:1), classify photos the same way from pixel size and EXIF orientation, and provide a pure best-template function that, given a spread and photo classes in order, returns the catalog id with the fewest class mismatches, then fewest empty slots; no photos yields one-per-page, ties go to catalog order (specific templates first), and too many photos yield `contact-5x4`.

#### Scenario: Two portraits

- **WHEN** best template is requested for two portrait photos on a two-page spread
- **THEN** the result has two portrait slots and no empty slots
