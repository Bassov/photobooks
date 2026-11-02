## MODIFIED Requirements

### Requirement: Inspector context header

For a spread or a photo the inspector SHALL open with one kit `InspectorShell` header row: the context icon and title ("Spread" / "Photo") with the spread meta line ("Pages 2–3 · N empty"). The inspector SHALL NOT draw a hide button of its own; the top-bar toggle hides and shows it. The Endpaper context SHALL open on its own kit head with nothing above it. Under the Photo header the inspector SHALL open on collapsible Photo (file name, pixel size, resolution chip and "Remove from frame", or "Empty — drag a photo"), Fit & crop and Rotate & flip sections, all expanded; a closed section SHALL be only its 36 px title row (37 px apart), and collapsing Fit & crop or Rotate & flip SHALL NOT leave crop mode. Below them it SHALL list collapsed Adjust, Caption, Position & size (frame lock on its title row), Frame style (summary: the style name or "None"; editing a style restyles every frame using it) and Arrange (summary "z N", N its layer from the back), summaries following book state, then the kit Delete frame button (28 px inset, `--destructive` ink).

#### Scenario: Spread header

- **WHEN** a spread is selected and no frame
- **THEN** the header row reads "Spread" over "Pages … · N empty" and the inspector has no hide button
