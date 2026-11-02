## ADDED Requirements

### Requirement: Master inspector and inherited grid

In Masters mode the Inspector SHALL show, for the shown parent, a head (parent name; "Used by N pages" / "Used by 1 page" / "Not used yet", counting the pages of every spread that resolves to it) and a GRID section (Columns, Rows, Gutter, Row gap, margins T / B / I / O with a link toggle). A committed field MUST write one `setSpreadGrid` patch to the parent (one history step); while linked, a margin edit writes all four margins. A frame selected on the master SHALL show the spread frame inspector; Esc or an empty click on the master canvas returns to the master inspector; with no parents the Inspector SHALL show "Create a master with New master to set its grid.". The master canvas SHALL always draw the parent's grid (outside Preview) and its name below the spread. The effective grid of a spread SHALL be book → parent → spread, a field set only by the parent reporting source `master`; a parent grid edit MUST re-render only the parent and the spreads resolving to it.

#### Scenario: Master grid reaches its spreads

- **WHEN** Master A is used by every spread but one (None) and its Columns is set to 5
- **THEN** the master canvas shows 5 columns per page, every Master A spread resolves 5 columns, and the None spread keeps the book grid
