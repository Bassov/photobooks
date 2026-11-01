## MODIFIED Requirements

### Requirement: Layout picker matches the kit

The Spread inspector's Layout section SHALL follow kit `#/demo`: a collapsible "Layout" section header (uppercase eyebrow, summary of the current layout only while collapsed, "Save as template" button while expanded), "All N" / "My templates N" tabs whose counts are the real builtin + saved layouts, and tiles in kit builtin order — Full bleed, One per page, Hero + two, Hero + grid, Panorama, Three across, Framed single, Offset pair, Two portraits, Landscape + 2 portraits — followed by saved layouts in save order. Each tile SHALL show a 2:1 thumbnail whose slots stay inside the thumbnail's paper box. "Suggested for N photos" SHALL list at most three layouts: the first builtins in kit order whose slot count equals the photo count, the current layout included and shown pressed. Hovering or focusing a tile SHALL preview its slots on the active spread until the pointer or focus leaves or the layout is applied.

#### Scenario: Full bleed thumbnail stays inside its tile

- **WHEN** the Spread inspector shows the Full bleed tile for any spread
- **THEN** every slot of its thumbnail lies inside the thumbnail's box

#### Scenario: Hover previews slots

- **WHEN** the user hovers a layout tile and then moves away
- **THEN** the active spread shows that layout's slots as a preview, and the preview disappears afterwards

### Requirement: Preview paints book content only

Preview (presentation) SHALL render spreads without any editor layer: no frame controls, selection outline, handles, size tag, grid, guides or drop / hover chrome. Preview SHALL open on the cover (position "Cover"); Next goes to the first spread. Leaving Preview SHALL restore the editor with its selection unchanged.

#### Scenario: Selected frame in Preview

- **WHEN** a frame is selected and the grid is shown, and the user opens Preview
- **THEN** the presentation has no handles, size tag, pressed frame, frame control or grid, and after Esc the frame is still selected

### Requirement: Inspector context header

For a spread or a photo the inspector SHALL open with one kit `InspectorShell` header row: the context icon and title ("Spread" / "Photo") with the spread meta line ("Pages 2–3 · N empty"). The inspector SHALL NOT draw a hide button of its own; the top-bar toggle hides and shows it. The Endpaper context SHALL open on its own kit head with nothing above it.

#### Scenario: Spread header

- **WHEN** a spread is selected and no frame
- **THEN** the header row reads "Spread" over "Pages … · N empty" and the inspector has no hide button
