## MODIFIED Requirements

### Requirement: Layout picker matches the kit

The Spread inspector's Layout section SHALL follow kit `#/demo` with the Owner's 2026-11-02 simplification: a collapsible "Layout" section header (uppercase eyebrow followed by "· <name>" of the selected layout, "Save as template" button while expanded), "All N" / "My templates N" tabs whose counts are the listed builtin + saved layouts, Photos Any / 1 / 2 / 3 / 4+ chips, no search field and no "Suggested" group: one 2-column list sorted by slot count ascending, kit builtin order (Full bleed, One per page, Hero + two, Hero + grid, Panorama, Three across, Framed single, Offset pair, Two portraits, Landscape + 2 portraits) then saved layouts in save order inside a count. Builtin tiles SHALL show no caption (name as tooltip and accessible name); saved tiles keep theirs. Two portraits SHALL NOT be listed where its frames have One per page's count and lie inside them; a book stored with it there keeps its frame rects and shows One per page pressed. Each tile SHALL show a 2:1 thumbnail whose slots stay inside the thumbnail's paper box. Hovering or focusing a tile SHALL preview its slots on the active spread until the pointer or focus leaves or the layout is applied.

#### Scenario: One sorted list

- **WHEN** spread 2–3 is selected with One per page, or opened from a saved book whose spread 2–3 uses Two portraits
- **THEN** the list starts with the 1-slot builtins, has no caption, search or "Suggested" group, One per page is pressed with the stored rects unchanged and the header reads "Layout · One per page"

#### Scenario: Hover previews slots

- **WHEN** the user hovers a layout tile and then moves away
- **THEN** the active spread shows that layout's slots as a preview, and the preview disappears afterwards

### Requirement: Saved layout templates

"Save as template" (header `+` or the button under the tiles) SHALL save the selected spread's layout under an inline-editable name. Saved layouts SHALL persist per browser, be listed under "My templates" and under "All" after the builtins with the same slot count, apply like builtins, and offer Rename / Duplicate / Delete from a tile menu.

#### Scenario: Save and reload

- **WHEN** a new user (My templates 0) saves spread 2–3, names it "Trip opener" and reloads
- **THEN** "My templates 1" lists "Trip opener" and "All" lists it after the builtins with its slot count

#### Scenario: Kit fixture

- **WHEN** a test build opens with `?templates=kit` on the one-page first spread
- **THEN** the tabs read "All 13" / "My templates 3"; production builds ignore the parameter
