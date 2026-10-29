## MODIFIED Requirements

### Requirement: Layout grid overlay and snap state

The editor SHALL draw the effective layout grid (content box, columns, rows per page) as a non-interactive editor-only overlay when shown, toggled by a TopBar control and Ctrl+'; Shift+S flips a snap on/off flag (default on). While the grid is shown and snap is on, frame move and resize edges SHALL snap (16 px pull, zoom-aware) to column and row edges through the same anchor index as frame / page / guide snapping, which keeps priority; the active target shows as one grey snap line per axis and a `bg-field` pill `snap · column N` / `snap · row N` (not a toast). Hidden grid, snap off or Alt held: no grid snap.

#### Scenario: Move snaps to a column

- **WHEN** the grid is shown, snap is on and a frame's edge is dragged within 16 px of a column edge
- **THEN** the edge lands on it and the pill reads `snap · column N`

#### Scenario: Grid snap bypassed

- **WHEN** the grid is hidden, Alt is held or snap is off
- **THEN** no grid snap, line or pill shows
