## MODIFIED Requirements

### Requirement: Adjustable filmstrip thumbnail size

The filmstrip dock SHALL let the user change the thumbnail height H with a separator on the dock top edge (`role=separator`, aria-valuemin 56 / valuemax / valuenow = H): pointer drag in 4 px steps, ↑/↓ ±8, Home min, End max, Enter or double-click = `auto`. `auto` = clamp(76, floor(0.085 · innerHeight), 160); manual H stays in 56 .. min(240, floor(0.5 · (innerHeight − 48)) − 64). H is persisted per device in `localStorage["photobooks.filmstrip.thumb.v2"]` (number or "auto"); a window resize re-clamps without writing. Thumbs, the empty-state row and the virtual window follow H with no gaps in the scrolled strip; file names show under thumbs only at H ≥ 90. Scrolling MUST stay inside the filmstrip scrollport.

#### Scenario: Resize while scrolled mid-gallery

- **WHEN** the user drags the separator up 52 px from the 76 px default at 1440 × 900 with a long gallery scrolled mid-strip
- **THEN** thumbs are 128 px high, a "128 px" chip shows only while dragging, the rendered row count stays bounded, and a reload keeps 128 px
