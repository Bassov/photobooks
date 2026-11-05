## MODIFIED Requirements

### Requirement: Inspector context header

For a spread or a photo the inspector SHALL open with one kit `InspectorShell` header row: the context icon and title ("Spread" / "Photo") with the spread meta line ("Pages 2–3 · N empty"). With no frame, cover, endpaper or book context selected the inspector SHALL show the Spread context of the active spread (the first spread while none is active); Esc, list rows, grey presses and Hand pans SHALL NOT leave it on the empty hint while the book has spreads. The inspector SHALL NOT draw a hide button of its own; the top-bar toggle hides and shows it. The Endpaper context SHALL open on its own kit head with nothing above it. For a local override copy the Photo / Text header SHALL add the meta line "Override · `parent name`" and a right-end 28 px "Reset to parent" ↺ that removes the copy ("Reset to parent") and leaves the inspector on the spread. Under the Photo header the inspector SHALL open on collapsible Photo (file name, pixel size, resolution chip and "Remove from frame", or "Empty — drag a photo"), Fit & crop and Rotate & flip sections, all expanded; a closed section SHALL be only its 36 px title row (37 px apart), and collapsing Fit & crop or Rotate & flip SHALL NOT leave crop mode. Below them it SHALL list collapsed Adjust, Caption, Position & size (frame lock on its title row), Frame style (summary: the style name or "None"; editing a style restyles every frame using it) and Arrange (summary "z N", N its layer from the back), summaries following book state, then the kit Delete frame button (28 px inset, `--destructive` ink).

#### Scenario: Spread header

- **WHEN** a spread is active and no frame is selected, including after Esc or after re-picking the spread from the list
- **THEN** the header row reads "Spread" over "Pages … · N empty" and the inspector has no hide button

### Requirement: Spread inspector sections in kit order

With a spread selected and no frame, the inspector SHALL list the kit sections in order: Layout, Master & spacing, Background, Grid. Master & spacing SHALL offer a full-width Master select (the book's parents in book order, the default labelled "`name` · default", plus None; hidden when the book has no parents) for any number of parents, a status line ("Book default", "Instead of `default`", "No master on this spread") with "Edit master" opening Masters mode on the shown master, and kit Margin (0–30 mm, all four spread margins) and Gap (0–20 mm, both gutters) sliders with editable values. Only when the spread overrides or hides parent items SHALL Master & spacing list them after the sliders under "Changed from `parent name`" with "Reset all" (`resetSpreadToParent`, "Reset spread to parent"): overridden frames, hidden frames, overridden guides, hidden guides (frames top first, guides vertical then horizontal by position), each "`name` · override" / "`name` · hidden" ("Photo frame", "Empty frame", `Text “first 24 chars”`, "Guide · vertical 74.2 mm") with a ↺ that resets that item; hidden ids of deleted parent items are not listed. Background SHALL offer the six kit swatches and set only that spread's paper colour.

#### Scenario: Margin and gap values

- **WHEN** the user types 12 into the Margin value and 99 into the Gap value of spread 2–3
- **THEN** all four spread margins are 12 mm and the Gap value is clamped to 20 mm

#### Scenario: Spread background

- **WHEN** the user picks the dark swatch on spread 2–3
- **THEN** that spread paints the swatch colour and the other spreads keep the page colour
