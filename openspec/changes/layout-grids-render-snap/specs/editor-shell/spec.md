## ADDED Requirements

### Requirement: Layout grid overlay and snap state

The editor SHALL draw the effective layout grid (content box, columns, rows per page) as a non-interactive editor-only overlay when the grid is shown, toggled by a TopBar control and Ctrl+'. Shift+S SHALL flip a snap on/off view flag (default on). A pure grid-snap module (16 CSS px pull; inactive when the grid is hidden, snap is off, or Alt is held) is available but dormant until frame move/resize exists (`layout-grids-snap-wire`).

#### Scenario: Show and hide

- **WHEN** the grid is shown
- **THEN** each page shows a dashed content box and the effective columns × rows; hiding removes the overlay
