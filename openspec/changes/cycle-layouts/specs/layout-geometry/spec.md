## ADDED Requirements

### Requirement: Layout cycle pill and keys

The active Pages-mode spread SHALL show a camera-locked `layout-cycle` pill (centre x = paper centre, bottom = paper top − 8 screen px, height 28) naming the current layout and `i/n` of its set: the inspector picker's layouts with as many slots as the spread has non-text frames, in picker order (Custom when the current layout is not in it). ‹ / › and Shift+`[` / Shift+`]` SHALL apply the previous / next layout (wrapping; from Custom › gives the first, ‹ the last) with the picker's op, keeping frame ids, and a run of presses on one spread SHALL be one "Change layout" undo step. The pill SHALL be hidden in Masters, in Preview, during an asset drag, marquee, frame gesture, crop or text edit, when the set has fewer than 2 layouts, and when a stacked spread's gap above is under 63 px (the keys still act then); bare `[` / `]` SHALL keep toggling the panels, and a press on the pill SHALL not activate a spread or start a marquee.

#### Scenario: Three presses undo in one step

- **WHEN** Shift+`]` is pressed three times on the active spread 2–3 and then Ctrl+Z
- **THEN** the spread has its first layout again, the frames keep their photos, fit, adjust and caption, and `]` alone still toggles the inspector
