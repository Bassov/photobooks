## MODIFIED Requirements

### Requirement: Preview paints book content only

Preview SHALL open the site's book page of the live editor book (nothing published or encoded) under a 48 px bar with Back, on the cover; it SHALL render spreads without any editor layer: no frame controls, selection outline, handles, size tag, grid, guides or drop / hover chrome. While it is open no editor shortcut SHALL run; Esc SHALL close Fullscreen first, then the preview, restoring the editor's spread, selection, zoom and scroll unchanged with focus on Preview.

#### Scenario: Selected frame in Preview

- **WHEN** a frame is selected and the grid is shown, and the user opens Preview and steps to its spread
- **THEN** the preview has no handles, size tag, pressed frame, frame control or grid, Delete changes nothing, and after Esc the frame is still selected
