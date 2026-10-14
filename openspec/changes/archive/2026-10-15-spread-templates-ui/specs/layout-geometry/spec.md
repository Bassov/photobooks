# Spec Delta

## MODIFIED Requirements

### Requirement: Gallery and placement ops

The system SHALL expose pure document ops that return a new book: add asset ids to the gallery (and assets map), remove from gallery cascading all placements of that asset, place an asset into an empty frame, replace a filled frame's asset, unplace a frame, swap two frames' placements (or move when the target is empty), apply a catalog template, and add / remove / move spreads. Place on an already-filled frame MUST not overwrite (no-op or typed failure); replace is the overwrite path. Add-spread SHALL insert at a given index or append and apply the one-per-page template so the new spread has empty margin-inset frame(s) for its page count and `templateId` `one-per-page`. When add-spread changes the page count of an existing spread that stores a catalog template id, the system MUST re-apply that template so the spread's frames match the new page count. Ops MUST preserve referential invariants (no dangling asset refs; every placed asset remains in the gallery). Removing the last remaining spread MUST be refused (book unchanged or typed failure). Unchanged spreads MUST keep object identity (structural sharing).

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

#### Scenario: Add spread re-applies template when page role changes

- **WHEN** add-spread appends to a three-spread book whose last spread stores a catalog template
- **THEN** the former last spread, now interior, has frames matching that same template for a two-page spread, and the new last spread has `templateId` one-per-page with empty frame(s) for a one-page spread

#### Scenario: Cannot remove last spread

- **WHEN** remove-spread is applied to the only spread in the book
- **THEN** the book is unchanged (or the op reports failure) and at least one spread remains
