## ADDED Requirements

### Requirement: Layout grid overlay and snap

The editor SHALL draw the effective layout grid (content box, columns, rows per page) as a non-interactive editor-only overlay when the grid is shown, toggled by a TopBar control and Ctrl+'. Grid snapping SHALL pull frame edges to column/row edges within 16 CSS px only while the grid is shown and snap is on, and not while Alt is held.

#### Scenario: Show and hide

- **WHEN** the grid is shown
- **THEN** each page shows a dashed content box and the effective columns × rows; hiding removes the overlay
