## ADDED Requirements

### Requirement: Layout grid settings

The book layout grid (margins top / bottom / inside / outside, columns, rows, column and row gutters) SHALL be editable at book level, and a spread MAY override single fields. Columns and rows MUST clamp to 1–12; margins and gutters MUST be ≥ 0. A spread override stores only the fields it changes; resetting removes it. A grid edit MUST be one history step (undoable) and MUST re-align only templated spreads that read a changed field from the grid, keeping placements.

#### Scenario: Override one field and reset

- **WHEN** a spread overrides columns to 5 and the book grid has 2
- **THEN** that spread resolves 5 columns, others 2, and reset restores the book value

### Requirement: Layout grid editing UI

The Inspector SHALL offer Spread and Book tabs, each with a "Layout grid" section (summary `columns×rows`, eight numeric fields, a header toggle that shows or hides an editor-only grid overlay, and the note "Facing pages are mirrored: inside = spine side."). The Spread tab MUST label each field BOOK or SPREAD and offer "Reset to book grid", disabled when the spread has no override. The overlay MUST NOT appear in thumbnails or output.

#### Scenario: Spread override label

- **WHEN** the user changes Columns on a spread
- **THEN** its Columns label reads SPREAD and Reset to book grid is enabled
