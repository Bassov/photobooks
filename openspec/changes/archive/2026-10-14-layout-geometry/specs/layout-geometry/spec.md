# layout-geometry Specification

## Purpose

Defines pure layout geometry for photobooks: template frame generation on the layout grid, spread resolution for painters, document ops for gallery and placements, and placement selectors — without UI or platform I/O.

## ADDED Requirements

### Requirement: Layout templates on the grid

The system SHALL provide a fixed catalog of templates — full-bleed, one-per-page, 2-up, and 4-grid — each generating frames in millimeters. Spread coordinates originate at the top-left trim corner. Effective layout grid is the spread override when present, otherwise the book-level grid. Applying a template SHALL replace frames, set `templateId`, rebind `assetId`/crop by frame index order, preserve existing frame ids by index (mint only for extras; drop unused ids), and use these layouts: full-bleed is one frame from `(-bleed,-bleed)` sized to spread width/height plus twice bleed on each axis; one-per-page is one margin-inset frame per page (left/right halves on two-page spreads); 2-up is two equal columns in the whole-spread margin-inset box separated by the column gutter; 4-grid is a 2×2 grid in that same box using column and row gutters.

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

### Requirement: Resolve spread for painters

The system SHALL resolve a spread into a flat list of items (frame id, rect in mm, optional asset id, optional source crop rect in normalized source space, z-order, rotation) plus derived page cut lines. First and last spreads SHALL be one page wide (trim width); interior spreads SHALL be two pages wide (twice trim width). One-page spreads SHALL have no page cuts; two-page spreads SHALL expose a vertical cut at trim width. Rotation SHALL be zero until free-frame rotation exists. When an item has an asset id, source crop rect SHALL be derived from cover-fit of the asset aspect into the frame rect combined with the frame crop (default crop is cover at zoom 1, center 0.5/0.5). Aspect ratio SHALL come from a caller-supplied lookup defaulting to 1 when omitted. Structural resolve data (frame geometry, z, page cuts) for the same spread object, book settings identity, spread index, and spread count MAY be memoized; source crop rects MUST be recomputed from the current aspect lookup on every call. Memo MUST invalidate when move/add/remove changes a spread's page role.

#### Scenario: Interior spread has a center cut

- **WHEN** a book has at least three spreads and the middle spread is resolved
- **THEN** the result includes a vertical page cut at the trim width

#### Scenario: Empty frame has no source crop

- **WHEN** a frame has no asset id
- **THEN** the resolved item omits source crop rect

#### Scenario: Aspect lookup changes crops without new spread identity

- **WHEN** the same spread is resolved twice with different aspect lookups for a placed asset
- **THEN** source crop rects differ according to the lookups while frame rects stay the same

### Requirement: Gallery and placement ops

The system SHALL expose pure document ops that return a new book: add asset ids to the gallery (and assets map), remove from gallery cascading all placements of that asset, place an asset into an empty frame, replace a filled frame's asset, unplace a frame, swap two frames' placements (or move when the target is empty), apply a catalog template, and add / remove / move spreads. Place on an already-filled frame MUST not overwrite (no-op or typed failure); replace is the overwrite path. Add-spread SHALL insert at a given index or append and apply the one-per-page template so the new spread has empty margin-inset frame(s) for its page count and `templateId` `one-per-page`. Ops MUST preserve referential invariants (no dangling asset refs; every placed asset remains in the gallery). Removing the last remaining spread MUST be refused (book unchanged or typed failure). Unchanged spreads MUST keep object identity (structural sharing).

#### Scenario: Remove from gallery clears placements

- **WHEN** an asset placed on one or more frames is removed from the gallery
- **THEN** those frames no longer reference the asset and the asset is absent from gallery and assets

#### Scenario: Place into empty frame

- **WHEN** place is applied to an empty frame with a gallery asset
- **THEN** the frame references that asset id

#### Scenario: Place on filled frame does not overwrite

- **WHEN** place is applied to a frame that already has an asset
- **THEN** the frame's asset id is unchanged

#### Scenario: Swap two filled frames

- **WHEN** swap is applied between two frames that each have an asset
- **THEN** their asset ids (and crops) are exchanged

#### Scenario: Add spread applies one-per-page

- **WHEN** add-spread appends to a one-spread book
- **THEN** the new last spread has `templateId` one-per-page and empty frame(s) matching one-per-page for a one-page spread

#### Scenario: Cannot remove last spread

- **WHEN** remove-spread is applied to the only spread in the book
- **THEN** the book is unchanged (or the op reports failure) and at least one spread remains

### Requirement: Placement selectors

The system SHALL compute placement count per asset id and the ordered list of gallery asset ids with zero placements. Counters MUST NOT be stored on the document.

#### Scenario: Unplaced assets

- **WHEN** the gallery contains assets A and B and only A is placed
- **THEN** unplaced selectors include B and exclude A

#### Scenario: Placement count

- **WHEN** the same asset is placed in two frames
- **THEN** its placement count is 2
