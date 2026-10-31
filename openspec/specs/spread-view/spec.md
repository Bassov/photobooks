# spread-view Specification

## Purpose

Shared DOM painter for one resolved spread (editor now, site later) plus the
query-loaded fixture that exercises it.

## Requirements

### Requirement: Paint frames from resolved geometry

The painter SHALL draw each resolved item as a frame from its millimeter rect
at a fixed px/mm scale, stacked by z-order.

#### Scenario: Frame matches millimeter rect

- **WHEN** a resolved item has a rect in millimeters
- **THEN** the painted frame's position and size equal that rect × the fixed scale

### Requirement: Empty and filled frames

Empty items (no asset) SHALL show a placeholder and MUST NOT show an image.
Filled items with a preview URL SHALL show an asynchronously decoded image,
clipped to the frame and framed to that item's source crop. Missing preview
URL → empty placeholder.

#### Scenario: Preview uses async decoding and crop

- **WHEN** a resolved item has an asset and a preview URL (optionally a source crop)
- **THEN** the frame shows an async-decoded image clipped to the frame (crop window when set)

#### Scenario: Missing preview stays a placeholder

- **WHEN** a resolved item has an asset id but no preview URL
- **THEN** the frame shows a placeholder and no image

### Requirement: Rotated photo inside a frame

A filled frame whose crop has quarter turns and/or a straighten angle (±45°) SHALL paint the photo turned about the frame center inside the frame clip. The crop window MUST keep the frame covered: with a straighten angle the window is sized and the crop center clamped so the frame's rotated bounding box stays inside the image (Fit mode is exempt). A turned photo's preview transform (crop gesture, straighten drag) SHALL go on a layer around the image, committed as one crop op at gesture end. Quarter turn resets zoom and pan; Fill|Fit and Reset to cover keep the rotation. Inspector "Rotate" (90° left / right, Straighten slider) and the `,` / `.` keys drive it; the rotation persists across save and reload.

#### Scenario: Straighten keeps the frame covered

- **WHEN** the user straightens a photo by any angle up to ±45°
- **THEN** all four frame corners lie inside the rotated photo

### Requirement: Missing-asset hatched frame

When a placed frame's asset is marked `missing` by the relink status store, the frame SHALL render a hatched (pattern) placeholder distinct from an empty-frame placeholder, and MUST NOT show a stale preview image for that asset. Empty frames (no `assetId`) keep the existing empty placeholder.

#### Scenario: Missing asset shows hatch

- **WHEN** a frame references an asset id whose relink status is `missing`
- **THEN** the frame shows a hatched missing placeholder and no photo image

### Requirement: Page cut line

The painter SHALL draw each derived page cut as a line at its mm offset on the same scale.

#### Scenario: Interior spread shows the center cut

- **WHEN** a resolved spread includes a vertical page cut
- **THEN** a cut line is painted at that offset

### Requirement: One spread updates on edit

An edit that changes a single spread SHALL update only that spread's painted output
(sibling spreads, including after template switch, stay unchanged).

### Requirement: Painter fixture on query

When `fixture=painter` is present, the system SHALL load an in-memory book of 40
spreads on the 4-grid template (four frames each), leave the first frame of the
first spread empty, supply synthetic previews for the other frames, and represent
that book on the pasteboard without mounting every spread.

#### Scenario: Fixture paints forty spreads

- **WHEN** the app opens with `fixture=painter`
- **THEN** the first spread's first frame is an empty placeholder, the pasteboard
  scroll extent represents 40 spreads, and fewer than 40 spreads are mounted

### Requirement: Pasteboard stacks spreads

The workspace SHALL stack every spread of the current book vertically in one
pasteboard, centered horizontally with a gap between spreads.

#### Scenario: Session book shows its spread

- **WHEN** the user opens the app without `fixture=painter`
- **THEN** the workspace shows three spreads (first/last single-page with one empty
  frame each; middle two-page with two empty frames) and no placeholder sentence

### Requirement: Off-screen spreads and paced expansion

Spreads outside the near-viewport window MUST NOT be mounted. Scroll extent MUST
still represent the full stack. While paced expansion toward a larger target is
in progress, spreads beyond the current paced window MAY stay unmounted even if
inside the eventual target; spacers MUST preserve scroll extent.

When the pasteboard target mounted range grows (including after zoom-out shrinks
stride), the system MUST expand the mounted window in paced steps so newly mounted
spreads do not all appear in a single animation frame. Spacers MUST keep full-stack
scroll extent. The mounted window MUST grow toward covering the visible scrollport
before overscan. When the stack fits the pasteboard port, paced expansion MUST
finish mounting every spread after the zoom gesture ends without LoAF in that
settle window.

#### Scenario: Mid-scroll and paced expand

- **WHEN** the user scrolls the fixture pasteboard to the middle (more spreads below)
  or the target window grows before paced expansion finishes
- **THEN** mounted spreads cover the visible scrollport (or stay within the current
  paced window), spacers keep full-stack extent, and mount count stays below the
  full stack until expansion completes

#### Scenario: Whole-book fit finishes after gesture end without LoAF

- **WHEN** the painter fixture is zoomed out until the whole stack fits, the zoom
  gesture ends, and paced expansion completes
- **THEN** every spread is mounted and that settle remount window records zero LoAF

### Requirement: Active spread follows scroll

The pasteboard SHALL mark exactly one spread as active: the spread that occupies
the scrollport. Scrolling a different spread into the port MUST update the mark.

#### Scenario: Active spread changes with scroll

- **WHEN** the fixture pasteboard is scrolled so a later spread occupies the scrollport
- **THEN** that later spread is marked active and the first spread is not

### Requirement: Mounted spread skips off-screen paint

Each mounted spread MUST contain layout, paint, and style, use content-visibility
that skips off-screen painting, and declare an intrinsic block size equal to its
slot in the stack.

### Requirement: Pasteboard scrollport

The pasteboard SHALL be the scrollport for the spread stack: vertical always, and
horizontal when the stack is wider than the port. The document MUST NOT gain
page-level horizontal or vertical scroll.

#### Scenario: Scroll stays inside the pasteboard

- **WHEN** the fixture stack is taller than the workspace, or zoom makes a spread
  wider than the port
- **THEN** scrolling happens only inside the pasteboard and the document element
  does not scroll

### Requirement: Pointer, keyboard zoom, and space pan

Wheel (with or without Ctrl/Cmd) and pinch SHALL zoom around the pointer; `+`/`-`
SHALL zoom around the viewport center. Zoom MUST NOT go below the pasteboard
zoom-out floor (whole-stack fit with spread-proportional gaps, or 16 px spreads for
a long book) and
MUST reach at least 400% of physical size. Opening the app MUST keep the current
layout scale. Holding Space and dragging on the pasteboard SHALL pan the pasteboard
scrollport whenever the pointer is over the pasteboard and focus is not in a text
input (including when focus remains on a filmstrip tile, toolbar control, or
Space-activated radio/checkbox). While Space is held (pan armed), editor panel
hotkeys MUST NOT toggle panels. Pressing Space without starting a pasteboard drag
MUST still activate a focused filmstrip tile or other Space-activated chrome control
(even when the pointer is over the pasteboard or filmstrip). When the pointer is not
over the pasteboard, Space MUST NOT arm pan so keyboard activation of focused
controls still works. Text inputs remain exempt from Space-pan. While pan is armed,
the canvas MUST expose `data-panning` and MUST NOT show a focus ring on the canvas
viewport.

#### Scenario: Wheel zoom keeps the pointer still

- **WHEN** the user wheels (or Ctrl-/Cmd-wheels) over a spread
- **THEN** that spread's on-screen size changes and the point under the pointer stays

#### Scenario: Plus zooms about the center; zoom-out stops at fit

- **WHEN** the user presses `+`, or zooms out until the stack fits the port
- **THEN** the stack grows about the viewport center (and the zoom indicator updates),
  or further zoom-out does not shrink below the zoom-out floor

#### Scenario: Space drag moves the stack

- **WHEN** the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

#### Scenario: Space drag pans after filmstrip or chrome focus

- **WHEN** focus is on a filmstrip tile or other non-text chrome control, the pointer
  is over the pasteboard, and the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag and that Space does
  not toggle the focused control

#### Scenario: Space activates filmstrip tile when pointer is over pasteboard

- **WHEN** focus is on a filmstrip tile, the pointer is over the pasteboard or
  filmstrip, and the user presses Space without dragging on the pasteboard
- **THEN** the focused tile activates or toggles selection and pan does not move the
  pasteboard

#### Scenario: Space activates chrome when pointer is off the pasteboard

- **WHEN** focus is on a filmstrip tile or Space-activated control and the pointer
  is not over the pasteboard and the user presses Space
- **THEN** pan does not arm and the focused control may activate

#### Scenario: Space held blocks panel hotkeys

- **WHEN** the user holds Space and presses a panel hotkey (`[`, `\`, `]`, `i`, or
  hide-all chord)
- **THEN** panel visibility does not change

### Requirement: Whole-book zoom mounts the visible stack

When the painter fixture is zoomed so the full stack fits in the pasteboard port,
or out to the zoom-out floor, the mounted window MUST include every spread in that
stack.

### Requirement: Placed frames show the covering tier

After the camera gesture settles, a filled frame SHALL display the covering zoom
tier for its on-screen size. An empty frame MUST remain a placeholder.

#### Scenario: Settled zoom shows the covering tier

- **WHEN** the painter fixture zoom reaches at least 400% of physical size and the
  gesture has settled
- **THEN** a filled frame shows an image whose tier covers that frame's on-screen size;
  the first frame of the first spread stays a placeholder with no image

### Requirement: Drop and frame-drag hover

While a gallery photo or filled frame is dragged across the pasteboard, at most one
drop-hover attribute SHALL be set (the frame under the pointer, changing only when
the pointer moves onto a different frame). On the filmstrip, hover MUST be the
filmstrip scrollport and no frame. Gallery drag payload MUST identify the gallery
asset; frame drag MUST identify the source frame; neither MUST carry file bytes.

#### Scenario: Hover follows the pointer; clears off a frame

- **WHEN** a gallery photo or filled frame is dragged onto another frame, or onto
  non-frame pasteboard space
- **THEN** only the frame under the pointer has drop-hover, or no frame has it

#### Scenario: Filmstrip hover and gallery payload

- **WHEN** a filled frame is dragged onto the filmstrip, or a gallery photo onto a frame
- **THEN** the filmstrip scrollport has drop-hover and no frame does; or the drag
  identifies that gallery asset and not a source frame

### Requirement: Pressed frame outline

A frame button that is the move source MUST show a 2px solid `--select` outline (1px offset) with a white 1px ring and eight resize handles while `aria-pressed` is true. Unselected frames MUST NOT show any border, outline, ring or shadow, including on keyboard focus; photos fill flush.

#### Scenario: Selection-only chrome

- **WHEN** no frame is pressed
- **THEN** no frame paints a ring or outline

### Requirement: Selection re-renders only when labels change

A mounted spread MUST re-render for a gallery or move-source change only when that
change alters the frame labels on that spread.

#### Scenario: Idle vs refresh on selection

- **WHEN** two spreads are mounted and gallery selection changes while a photo stays
  selected, or a move source moves among frames on the first spread
- **THEN** the unaffected spread's render count does not increase
- **WHEN** a move source is set, cleared, or moved onto the second spread
- **THEN** the second spread's render count increases

### Requirement: Selection labels stay the same

Frame controls MUST NOT expose a “Replace photo” label or Replace button. Labels for
move/swap remain: “Cancel move” on the move-source frame; “Swap photos” / “Move photo
here” on other frames while a move source exists; empty frames without a move source
stay “Place photo” placeholders. Gallery selection MUST NOT change frame control
labels into place/replace click targets — place/replace is filmstrip drag only.
A pointer click on the selected frame MUST keep it selected (kit); keyboard activation
of the move source cancels the move. Escape or a click on the empty pasteboard deselects.

#### Scenario: No Replace control

- **WHEN** a gallery photo is selected and the user inspects a filled or empty frame
  control
- **THEN** no control named “Replace photo” is present

#### Scenario: Click keeps the selected frame

- **WHEN** the user drops a photo on a frame and clicks that frame, or clicks a frame twice
- **THEN** the frame stays selected with the Photo inspector and 8 handles

### Requirement: Thumb publish re-renders only for own photos

A mounted spread MUST re-render for a filmstrip thumb publish only when that
publish changes the thumb URL of a photo placed on that spread. Sibling spreads
MUST NOT re-render when the publish is for a photo they do not place.

### Requirement: Drag source stays mounted through drop

While a filled-frame drag is in progress, the drag source MUST stay mounted until
`dragend` (including if the frame empties mid-drop) so document-level
click-suppression can clear.

### Requirement: Spread pager

The renderer SHALL provide a shared pager showing one spread at a time, navigable by arrow keys, Space, click on either half and horizontal swipe, exiting on Esc; neighbouring spreads SHALL stay mounted for preload and transitions SHALL use only `transform` and `opacity`.

#### Scenario: Next on the last spread

- **WHEN** the last spread is shown and the user navigates forward
- **THEN** the index does not change

#### Scenario: Click halves and Esc

- **WHEN** the user clicks the right (left) half, or presses Esc
- **THEN** the pager moves forward (back), or calls exit

### Requirement: Empty frames are selectable

Clicking an empty frame SHALL select it with the Phase A selection chrome (no photo-selected announcement). An empty selected frame is never a move / swap source: activating another frame selects that frame instead. The selection ends when the frame is removed or gains / loses its photo.

#### Scenario: Select empty, then another

- **WHEN** an empty frame is selected and the user clicks a filled frame
- **THEN** the filled frame becomes selected and no photo moves

### Requirement: Layout picker matches the kit

The Spread inspector's Layout section SHALL follow kit `#/demo`: a collapsible "Layout" section header (uppercase eyebrow, summary of the current layout only while collapsed, "Save as template" button while expanded), "All N" / "My templates N" tabs whose counts are the real builtin + saved layouts, and tiles in kit builtin order — Full bleed, One per page, Hero + two, Hero + grid, Panorama, Three across, Framed single, Offset pair, Two portraits, Landscape + 2 portraits — followed by saved layouts in save order. Each tile SHALL show a 2:1 thumbnail whose slots stay inside the thumbnail's paper box. "Suggested for N photos" SHALL list at most three layouts. Hovering or focusing a tile SHALL preview its slots on the active spread until the pointer or focus leaves or the layout is applied.

#### Scenario: Full bleed thumbnail stays inside its tile

- **WHEN** the Spread inspector shows the Full bleed tile for any spread
- **THEN** every slot of its thumbnail lies inside the thumbnail's box

#### Scenario: Hover previews slots

- **WHEN** the user hovers a layout tile and then moves away
- **THEN** the active spread shows that layout's slots as a preview, and the preview disappears afterwards

### Requirement: Preview paints book content only

Preview (presentation) SHALL render spreads without any editor layer: no frame controls, selection outline, handles, size tag, grid, guides or drop / hover chrome. Leaving Preview SHALL restore the editor with its selection unchanged.

#### Scenario: Selected frame in Preview

- **WHEN** a frame is selected and the grid is shown, and the user opens Preview
- **THEN** the presentation has no handles, size tag, pressed frame, frame control or grid, and after Esc the frame is still selected

### Requirement: Inspector context header

The inspector SHALL open with one kit `InspectorShell` header row: the context icon, title ("Spread" / "Photo") with the spread meta line ("Pages 2–3 · N empty"), and a "Hide inspector (I)" button with the panel-right-close icon at the right.

#### Scenario: Spread header

- **WHEN** a spread is selected and no frame
- **THEN** the header row reads "Spread" over "Pages … · N empty" with the collapse button in the same row

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
