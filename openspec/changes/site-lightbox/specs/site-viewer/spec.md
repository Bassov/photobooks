## ADDED Requirements

### Requirement: Fullscreen lightbox

The book page SHALL open a fullscreen lightbox (the presentation pager's `lightbox` variant) on the current slide from a Fullscreen button next to Share and from a click on the stage (a swipe steps, never opens). Each slide SHALL fit the viewport minus 64 top / 48 bottom / 64 sides (8 without a hover pointer) so no control covers it at zoom 1; ←/→/Space, Home/End, arrows (hover pointers only, hidden at the ends) and a swipe over 60 px SHALL step; zoom SHALL stay in 1–3× by transform only (double-click / tap toggles 1 ↔ 2 about the point, Ctrl+wheel / pinch about the cursor, `+`/`-`/`0`), panning clamped to the fit area; a step SHALL open the next slide at 1×; Esc or the X SHALL close at any zoom, return the book page to the lightbox's slide and focus the opener. Photo `sizes` SHALL follow the painted width × zoom and never shrink while open.

#### Scenario: Open and fit

- **WHEN** Fullscreen is pressed on the Alps book at 1440 × 900
- **THEN** the active spread is 1301.91 × 788 at (69.04, 64) and no control rect intersects it

#### Scenario: Zoom then close

- **WHEN** the spread is double-clicked and Esc is pressed
- **THEN** `data-zoom` reads `2.00` with the clicked point fixed, and Esc closes with focus back on the opener
