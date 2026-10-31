## MODIFIED Requirements

### Requirement: Layout picker matches the kit

The Spread inspector's Layout section SHALL follow kit `#/demo`: a collapsible "Layout" section header (uppercase eyebrow, summary of the current layout only while collapsed, "Save as template" button while expanded), "All N" / "My templates N" tabs whose counts are the real builtin + saved layouts, and tiles in kit builtin order — Full bleed, One per page, Hero + two, Hero + grid, Panorama, Three across, Framed single, Offset pair, Two portraits, Landscape + 2 portraits — followed by saved layouts in save order. Each tile SHALL show a 2:1 thumbnail whose slots stay inside the thumbnail's paper box. "Suggested for N photos" SHALL list at most three layouts. Hovering or focusing a tile SHALL preview its slots on the active spread until the pointer or focus leaves or the layout is applied.

#### Scenario: Full bleed thumbnail stays inside its tile

- **WHEN** the Spread inspector shows the Full bleed tile for any spread
- **THEN** every slot of its thumbnail lies inside the thumbnail's box

#### Scenario: Hover previews slots

- **WHEN** the user hovers a layout tile and then moves away
- **THEN** the active spread shows that layout's slots as a preview, and the preview disappears afterwards

## ADDED Requirements

### Requirement: Saved layout templates

"Save as template" (header `+` or the button under the tiles) SHALL save the selected spread's layout under an inline-editable name. Saved layouts SHALL persist per browser, be listed under "My templates" and after the builtins under "All", apply like builtins, and offer Rename / Duplicate / Delete from a tile menu.

#### Scenario: Save and reload

- **WHEN** a new user (My templates 0) saves spread 2–3, names it "Trip opener" and reloads
- **THEN** "My templates 1" lists "Trip opener" and "All" ends with it

#### Scenario: Kit fixture

- **WHEN** a test build opens with `?templates=kit`
- **THEN** the tabs read "All 13" / "My templates 3"; production builds ignore the parameter

### Requirement: Spread inspector sections in kit order

With a spread selected and no frame, the inspector SHALL list the kit sections in order: Layout, Master & spacing, Background, Grid. Master & spacing SHALL offer Master A / Master B / None and kit Margin (0–30 mm, all four spread margins) and Gap (0–20 mm, both gutters) sliders with editable values. Background SHALL offer the six kit swatches and set only that spread's paper colour.

#### Scenario: Margin and gap values

- **WHEN** the user types 12 into the Margin value and 99 into the Gap value of spread 2–3
- **THEN** all four spread margins are 12 mm and the Gap value is clamped to 20 mm

#### Scenario: Spread background

- **WHEN** the user picks the dark swatch on spread 2–3
- **THEN** that spread paints the swatch colour and the other spreads keep the page colour
