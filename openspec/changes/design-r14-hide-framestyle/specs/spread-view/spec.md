## MODIFIED Requirements

### Requirement: Inspector context header

For a spread or a photo the inspector SHALL open with one kit `InspectorShell` header row: the context icon and title ("Spread" / "Photo") with the spread meta line ("Pages 2–3 · N empty"). The inspector SHALL NOT draw a hide button of its own; the top-bar toggle hides and shows it. The Endpaper context SHALL open on its own kit head with nothing above it. Under the Photo header the inspector SHALL open on collapsible Photo (file name, pixel size, resolution chip and "Remove from frame", or "Empty — drag a photo"), Fit & crop and Rotate & flip sections, all expanded; a closed section SHALL be only its 36 px title row (37 px apart), and collapsing Fit & crop or Rotate & flip SHALL NOT leave crop mode. Below them it SHALL list collapsed Adjust, Caption and Position & size (Position & size carries the frame lock on its title row), then the kit Delete frame button (28 px inset, `--destructive` ink); Frame style and Arrange SHALL NOT render (Owner Q8, one switch in the Photo sections until their roadmap item).

#### Scenario: Spread header

- **WHEN** a spread is selected and no frame
- **THEN** the header row reads "Spread" over "Pages … · N empty" and the inspector has no hide button
