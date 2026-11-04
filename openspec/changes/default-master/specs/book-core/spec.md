## MODIFIED Requirements

### Requirement: Parent spread editing

The book SHALL support creating a parent (id unused by any spread or parent, name "Master `<next free letter>`", no items), renaming it (trimmed, non-empty; else unchanged) and deleting it; deleting SHALL set `parentId` to `null` on spreads that stored its id, so those spreads resolve to None. Every new book and every book opened from the library SHALL have a default parent: without a known `defaultParentId` an empty parent is added and set as the default (no stored `parentId` changes); deleting the default parent and clearing the default while parents exist MUST leave the book unchanged, and Make default sets `defaultParentId` (spreads without a stored `parentId` follow it). Every spread item op addressed to a parent id SHALL edit that parent's items exactly as it edits a spread's, and the parent SHALL resolve and paint as a two-page spread. Each create / rename / delete / item edit MUST be one history step and MUST notify only the parent and the spreads that resolve to it. The editor's Masters mode SHALL list the book's parents (thumb + name, a "Default" tag on the default, New master, Make default on the others, Rename, Delete disabled on the default) under a note naming the default, and show the selected parent on the canvas, where its items are added, moved and resized like spread items; the Masters list scrolls inside its panel only. The master canvas SHALL show the parent's `guides` like spread guides, show the rulers while rulers are on, and add / move / remove guides in `parent.guides` exactly as on a spread (ruler drag adds, release commits one history step, drop on its ruler removes).

#### Scenario: Delete falls back to None

- **WHEN** Master A is the book default, spread 2 stores `parentId` Master B, and Master B is deleted, then Master A
- **THEN** Master B is removed and spread 2 resolves to None; deleting Master A leaves the book unchanged

#### Scenario: A new book has Master A as default

- **WHEN** a new book is created, then Master B is added and made the default
- **THEN** the book first has one empty parent "Master A" as `defaultParentId` used by every spread, then every spread without a stored `parentId` resolves to Master B

#### Scenario: Move once, every spread updates

- **WHEN** every spread uses parent P and P's logo is moved once in Masters mode
- **THEN** the logo's rect changes in P only, and every spread resolves the logo at the new rect

#### Scenario: Ruler guide on a master

- **WHEN** rulers are on in Masters mode and a guide is dragged from the top ruler onto Master A, then moved, then undone
- **THEN** Master A's `guides` hold one horizontal guide at the dropped offset, the move is one history step that undo reverts, and no spread's own `guides` change

### Requirement: Master inspector and inherited grid

In Masters mode the Inspector SHALL show, for the shown parent, a head (parent name; for the default "Default · all N pages" / "Default · U of N pages" / "Default · no pages" over all book pages, else "Used by N pages" / "Used by 1 page" / "Not used yet", counting the pages of every spread that resolves to it; a non-default parent shows a "Make default" button, plus a hint when unused) and a GRID section (Columns, Rows, Gutter, Row gap, margins T / B / I / O with a link toggle). A committed field MUST write one `setSpreadGrid` patch to the parent (one history step); while linked, a margin edit writes all four margins. A frame selected on the master SHALL show the spread frame inspector; Esc or an empty click on the master canvas returns to the master inspector; with no parents the Inspector SHALL show "Create a master with New master to set its grid.". The master canvas SHALL always draw the parent's grid (outside Preview) and its name below the spread. The effective grid of a spread SHALL be book → parent → spread, a field set only by the parent reporting source `master`; a parent grid edit MUST re-render only the parent and the spreads resolving to it.

#### Scenario: Master grid reaches its spreads

- **WHEN** Master A is used by every spread but one (None) and its Columns is set to 5
- **THEN** the master canvas shows 5 columns per page, every Master A spread resolves 5 columns, and the None spread keeps the book grid
