## MODIFIED Requirements

### Requirement: Layout grid settings

The book layout grid (margins top / bottom / inside / outside, columns, rows, column and row gutters) SHALL be editable at book level, and a spread MAY override single fields. Columns and rows MUST clamp to 1–12; margins and gutters MUST be ≥ 0. A spread override stores only the fields it changes; resetting removes it, and `resetSpreadGridFields` removes only the listed fields (the whole override when none is left). A grid edit MUST be one history step (undoable) and MUST re-align, keeping placements, only templated spreads whose effective grid reads a changed field from the edited level: a book edit the spreads where that field's source is `book`; a master edit the spreads using that master that do not override it; a spread edit, reset or parent change that spread.

#### Scenario: Override one field and reset

- **WHEN** a spread overrides columns to 5 and the book grid has 2
- **THEN** that spread resolves 5 columns, others 2, and reset restores the book value

#### Scenario: Master gutter re-aligns its spreads

- **WHEN** Master A is used by three templated spreads, one of them overriding the column gutter, a fourth spread uses Master B, and Master A's column gutter changes
- **THEN** the two inheriting spreads' frames move in one history step, the overriding and Master B spreads keep their frames, and placements stay
