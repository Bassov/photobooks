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

Ctrl/Cmd + wheel and pinch SHALL zoom around the pointer; `+`/`-` SHALL zoom
around the viewport center. Zoom MUST NOT go below whole-stack fit and MUST reach
at least 400% of physical size. Opening the app MUST keep the current layout scale.
Holding Space and dragging on the pasteboard SHALL pan the pasteboard scrollport
whenever the pointer is over the pasteboard and focus is not in a text input
(including when focus remains on a filmstrip tile, toolbar control, or
Space-activated radio/checkbox). When the pointer is not over the pasteboard,
Space MUST NOT arm pan so keyboard activation of focused controls still works.

#### Scenario: Wheel zoom keeps the pointer still

- **WHEN** the user Ctrl- or Cmd-wheels over a spread
- **THEN** that spread's on-screen size changes and the point under the pointer stays

#### Scenario: Plus zooms about the center; zoom-out stops at fit

- **WHEN** the user presses `+`, or zooms out until the stack fits the port
- **THEN** the stack grows about the viewport center (and the zoom indicator updates),
  or further zoom-out does not shrink below whole-book fit

#### Scenario: Space drag moves the stack

- **WHEN** the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

#### Scenario: Space drag pans after filmstrip or chrome focus

- **WHEN** focus is on a filmstrip tile or other non-text chrome control, the pointer
  is over the pasteboard, and the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

#### Scenario: Space activates chrome when pointer is off the pasteboard

- **WHEN** focus is on a filmstrip tile or Space-activated control and the pointer
  is not over the pasteboard and the user presses Space
- **THEN** pan does not arm and the focused control may activate

### Requirement: Whole-book zoom mounts the visible stack

When the painter fixture is zoomed so the full stack fits in the pasteboard port,
the mounted window MUST include every spread in that stack.

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

A frame button that is the move source MUST show an outline wider than zero while
`aria-pressed` is true.

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

Frame controls MUST keep existing names when selection changes: “Place photo” /
“Replace photo” while a gallery photo is selected; “Cancel move” on the move-source
frame; “Swap photos” / “Move photo here” on other frames while a move source exists.

### Requirement: Thumb publish re-renders only for own photos

A mounted spread MUST re-render for a filmstrip thumb publish only when that
publish changes the thumb URL of a photo placed on that spread. Sibling spreads
MUST NOT re-render when the publish is for a photo they do not place.

### Requirement: Drag source stays mounted through drop

While a filled-frame drag is in progress, the drag source MUST stay mounted until
`dragend` (including if the frame empties mid-drop) so document-level
click-suppression can clear.
