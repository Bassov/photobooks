## MODIFIED Requirements

### Requirement: Spread inspector sections in kit order

With a spread selected and no frame, the inspector SHALL list the kit sections in order: Layout, Master & spacing, Background, Grid. Master & spacing SHALL offer the book's parents by name plus None (the switch is hidden when the book has no parents) and kit Margin (0–30 mm, all four spread margins) and Gap (0–20 mm, both gutters) sliders with editable values. Background SHALL offer the six kit swatches and set only that spread's paper colour.

#### Scenario: Margin and gap values

- **WHEN** the user types 12 into the Margin value and 99 into the Gap value of spread 2–3
- **THEN** all four spread margins are 12 mm and the Gap value is clamped to 20 mm

#### Scenario: Spread background

- **WHEN** the user picks the dark swatch on spread 2–3
- **THEN** that spread paints the swatch colour and the other spreads keep the page colour
