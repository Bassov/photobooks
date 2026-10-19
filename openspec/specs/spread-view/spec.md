# spread-view Specification

## Purpose

Shared DOM painter for one resolved spread, used by the editor now and by the site later, plus the query-loaded fixture that exercises it.

## Requirements

### Requirement: Paint frames from resolved geometry

The painter SHALL draw each resolved item as a frame whose position and size come from its millimeter rect at a fixed pixels-per-millimeter scale, stacked by z-order.

#### Scenario: Frame matches millimeter rect

- **WHEN** a resolved item has a rect in millimeters
- **THEN** the painted frame's position and size equal that rect multiplied by the fixed scale

### Requirement: Empty frames show placeholders

The painter SHALL show a placeholder and MUST NOT show an image for a resolved item that has no asset.

#### Scenario: Empty frame has no image

- **WHEN** a resolved item has no asset id
- **THEN** the frame shows a placeholder and does not render an image

### Requirement: Filled frames show cropped previews

The painter SHALL show an asynchronously decoded image for a resolved item that has an asset and a preview URL, clipped to the frame and framed to that item's source crop. When no preview URL is available, the frame SHALL show the empty placeholder instead.

#### Scenario: Preview uses async decoding

- **WHEN** a resolved item has an asset and a preview URL
- **THEN** the frame shows an image with asynchronous decoding

#### Scenario: Crop window fills the frame

- **WHEN** a resolved item has a source crop smaller than the full image
- **THEN** the visible preview is that crop window, clipped to the frame

#### Scenario: Missing preview stays a placeholder

- **WHEN** a resolved item has an asset id but no preview URL
- **THEN** the frame shows a placeholder and no image

### Requirement: Page cut line

The painter SHALL draw each derived page cut as a line at its millimeter offset on the same scale.

#### Scenario: Interior spread shows the center cut

- **WHEN** a resolved spread includes a vertical page cut
- **THEN** a cut line is painted at that offset

### Requirement: One spread updates on edit

An edit that changes a single spread SHALL update only that spread's painted output.

#### Scenario: Sibling spread is unchanged

- **WHEN** two spreads are painted and only the first spread's frames change
- **THEN** the second spread's painted output does not update

#### Scenario: Template switch leaves siblings unchanged

- **WHEN** two spreads are painted and only the first spread's template changes
- **THEN** the second spread's painted output does not update

### Requirement: Painter fixture on query

When the URL query `fixture=painter` is present, the system SHALL load an in-memory book of 40 spreads on the 4-grid template with four frames each, leave the first frame of the first spread empty, supply synthetic previews for the other frames, and represent that book on the pasteboard without mounting every spread.

#### Scenario: Fixture paints forty spreads

- **WHEN** the app opens with `fixture=painter`
- **THEN** the first spread's first frame is an empty placeholder, the pasteboard scroll extent represents 40 spreads, and fewer than 40 spreads are mounted

### Requirement: Pasteboard stacks spreads

The workspace SHALL stack every spread of the current book vertically in one pasteboard, centered horizontally with a gap between spreads.

#### Scenario: Session book shows its spread

- **WHEN** the user opens the app without `fixture=painter`
- **THEN** the workspace shows three spreads and does not show a placeholder sentence: the first and last are single-page with one empty frame placeholder each, and the middle is two-page with two empty frame placeholders

### Requirement: Off-screen spreads stay unmounted

Spreads outside the near-viewport window MUST NOT be mounted. The scroll extent MUST still represent the full stack, and the mounted window MUST cover the visible scrollport while more spreads remain beyond it. While a paced expansion toward a larger target window is in progress, spreads beyond the current paced window MAY remain unmounted even if they are inside the eventual target window; spacers MUST preserve scroll extent.

#### Scenario: Mid-scroll window covers the port

- **WHEN** the user scrolls the fixture pasteboard to the middle and more spreads remain below
- **THEN** mounted spreads cover the visible scrollport and the mounted count stays below the full stack

#### Scenario: Paced expand defers overscan mounts

- **WHEN** the target window grows and paced expansion has not yet reached the full target
- **THEN** spreads outside the current paced window stay unmounted and spacers keep the full-stack scroll extent

### Requirement: Paced pasteboard window expansion

When the pasteboard target mounted range grows (including after zoom-out shrinks stride), the system MUST expand the mounted window in paced steps so newly mounted spreads do not all appear in a single animation frame. Spacers MUST keep the full-stack scroll extent while expansion is in progress. The mounted window MUST grow toward covering the visible scrollport before overscan. When the stack fits the pasteboard port, paced expansion MUST finish mounting every spread after the zoom gesture ends without LoAF in that settle window.

#### Scenario: Zoom-out settle expands without a single-frame flood

- **WHEN** committed zoom shrinks the pasteboard stride so many previously off-screen spreads enter the target window
- **THEN** those spreads mount across more than one animation frame and spacers keep the full-stack scroll extent throughout

#### Scenario: Whole-book fit finishes after gesture end without LoAF

- **WHEN** the painter fixture is zoomed out until the whole stack fits in the pasteboard port, the zoom gesture ends, and paced expansion completes
- **THEN** every spread in the stack is mounted and that settle remount window records zero LoAF

### Requirement: Active spread follows scroll

The pasteboard SHALL mark exactly one spread as active: the spread that occupies the scrollport. When scrolling brings a different spread into the port, that spread MUST become the marked one.

#### Scenario: Active spread changes with scroll

- **WHEN** the fixture pasteboard is scrolled so a later spread occupies the scrollport
- **THEN** that later spread is marked active and the first spread is not

### Requirement: Mounted spread skips off-screen paint

Each mounted spread MUST contain layout, paint, and style, use content-visibility that skips off-screen painting, and declare an intrinsic block size equal to its slot in the stack.

#### Scenario: Mounted spread declares containment

- **WHEN** a spread is mounted on the pasteboard
- **THEN** that spread contains layout, paint, and style, skips off-screen painting via content-visibility, and has an intrinsic block size

### Requirement: Pasteboard scrollport

The pasteboard SHALL be the scrollport for the spread stack: vertical always, and horizontal when the stack is wider than the port. The document MUST NOT gain page-level horizontal or vertical scroll.

#### Scenario: Scroll stays inside the pasteboard

- **WHEN** the fixture stack is taller than the workspace
- **THEN** the pasteboard scrolls vertically and the document element does not scroll

#### Scenario: Wide zoom scrolls inside the pasteboard

- **WHEN** zoom makes a spread wider than the pasteboard port
- **THEN** horizontal scrolling happens only inside the pasteboard and the document element does not scroll

### Requirement: Pointer and keyboard zoom

Ctrl or Cmd plus wheel, and a pinch, SHALL zoom the pasteboard around the pointer. The `+` and `-` keys SHALL zoom around the viewport center. Zoom MUST NOT go below the level that fits the whole spread stack in the pasteboard port, and MUST be able to reach at least 400% of physical size. Opening the app MUST keep the current layout scale.

#### Scenario: Wheel zoom keeps the pointer still

- **WHEN** the user Ctrl- or Cmd-wheels over a spread
- **THEN** that spread's on-screen size changes and the point under the pointer stays in place

#### Scenario: Plus zooms about the center

- **WHEN** the user presses `+` while the pasteboard is in use
- **THEN** the stack grows about the viewport center and the zoom indicator updates

#### Scenario: Zoom out stops at the whole book

- **WHEN** the user zooms out until the stack fits in the pasteboard port
- **THEN** further zoom-out does not shrink the stack below that fit

### Requirement: Space pan

Holding Space and dragging over the pasteboard SHALL pan the pasteboard scrollport.

#### Scenario: Space drag moves the stack

- **WHEN** the user holds Space and drags across the pasteboard
- **THEN** the pasteboard scroll position changes with the drag

### Requirement: Whole-book zoom mounts the visible stack

When the painter fixture is zoomed so the full stack fits in the pasteboard port, the mounted window MUST include every spread in that stack.

#### Scenario: Fit-all mounts the fixture

- **WHEN** the painter fixture is zoomed so the whole book fits in the pasteboard port
- **THEN** every spread in the stack is mounted

### Requirement: Placed frames show the covering tier

After the camera gesture settles, a filled frame SHALL display the covering zoom tier for its on-screen size. An empty frame MUST remain a placeholder and MUST NOT show an image.

#### Scenario: Empty fixture frame stays empty

- **WHEN** the painter fixture is shown
- **THEN** the first frame of the first spread is a placeholder and has no image

#### Scenario: Settled zoom shows the covering tier

- **WHEN** the painter fixture zoom reaches at least 400% of physical size and the gesture has settled
- **THEN** a filled frame shows an image whose tier covers that frame's on-screen size

### Requirement: Drop hover marks one frame

While a gallery photo is dragged across the pasteboard, at most one frame SHALL carry the drop-hover attribute. That attribute MUST change only when the pointer moves onto a different frame. The drag payload MUST identify the gallery asset and MUST NOT carry file bytes.

#### Scenario: Hover follows the pointer

- **WHEN** a gallery photo is dragged from one frame onto another
- **THEN** only the frame under the pointer has the drop-hover attribute

#### Scenario: Hover clears off a frame

- **WHEN** a gallery photo is dragged from a frame onto pasteboard space that is not a frame
- **THEN** no frame has the drop-hover attribute

### Requirement: Frame drag hover marks one target

While a filled frame is dragged, at most one drop-hover attribute SHALL be set. On the pasteboard it MUST be the frame under the pointer, changing only when the pointer moves onto a different frame. On the filmstrip it MUST be the filmstrip scrollport and no frame. The drag payload MUST identify the source frame and MUST NOT carry file bytes. A gallery photo drag MUST keep identifying the gallery asset.

#### Scenario: Frame hover follows the pointer

- **WHEN** a filled frame is dragged from one frame onto another
- **THEN** only the frame under the pointer has the drop-hover attribute

#### Scenario: Filmstrip hover leaves frames clear

- **WHEN** a filled frame is dragged onto the filmstrip
- **THEN** the filmstrip scrollport has the drop-hover attribute and no frame has it

#### Scenario: Gallery drag payload stays the asset

- **WHEN** a gallery photo is dragged onto a frame
- **THEN** the drag identifies that gallery asset and does not identify a source frame

### Requirement: Pressed frame outline

A frame button that is the move source MUST show an outline wider than zero while `aria-pressed` is true.

#### Scenario: Pressed outline is visible

- **WHEN** a frame button is pressed
- **THEN** its computed outline width is greater than zero

### Requirement: Selection re-renders a spread only when its labels change

A mounted spread MUST re-render for a gallery or move-source change only when that change alters the frame labels on that spread.

#### Scenario: Another selected photo leaves both spreads idle

- **WHEN** two spreads are mounted and the selected gallery photo changes while a photo stays selected
- **THEN** neither spread's render count increases

#### Scenario: Source moves on the other spread

- **WHEN** two spreads are mounted, a move source is already on the first spread, and that source moves to another frame on the first spread
- **THEN** the second spread's render count does not increase

#### Scenario: Setting a source refreshes the spread

- **WHEN** two spreads are mounted and a move source is set
- **THEN** the second spread's render count increases

#### Scenario: Clearing a source refreshes the spread

- **WHEN** two spreads are mounted and an existing move source is cleared
- **THEN** the second spread's render count increases

#### Scenario: Moving the source onto this spread refreshes it

- **WHEN** two spreads are mounted and the move source moves from the first spread onto a frame on the second spread
- **THEN** the second spread's render count increases

### Requirement: Selection labels stay the same

Frame controls MUST keep their existing names when selection changes: “Place photo” or “Replace photo” while a gallery photo is selected, “Cancel move” on the move-source frame, and “Swap photos” or “Move photo here” on the other frames while a move source exists.

#### Scenario: Gallery selection names place or replace

- **WHEN** a gallery photo is selected
- **THEN** an empty frame is named “Place photo” and a filled frame is named “Replace photo”

#### Scenario: Move source names cancel, swap, or move

- **WHEN** no gallery photo is selected and a move source exists
- **THEN** the source frame is named “Cancel move” and each other frame is named “Swap photos” or “Move photo here”

### Requirement: Thumb publish re-renders a spread only for its own photos

A mounted spread MUST re-render for a filmstrip thumbnail publish only when that publish changes the thumb URL of a photo placed on that spread. Publishing a thumb for an asset placed only on another spread MUST NOT increase this spread's render count.

#### Scenario: Sibling idle when the other spread's photo gets a thumb

- **WHEN** two spreads are mounted with different placed photos and no tier or book preview URL for either, and a filmstrip thumb publishes for the photo on the first spread only
- **THEN** the second spread's render count does not increase

#### Scenario: Own spread refreshes when its photo gets a thumb

- **WHEN** a mounted spread has a placed photo with no covering tier or book preview URL, and a filmstrip thumb publishes for that photo
- **THEN** that spread's painted frame shows the new thumb URL

### Requirement: Drag source stays mounted through drop

While a filled-frame drag is in progress, the drag source element MUST remain mounted until `dragend` so the document-level gesture listener can clear click-suppression state. The painter MUST NOT unmount that source solely because the frame emptied mid-drop.

#### Scenario: Emptying a frame mid-drop keeps the source mounted

- **WHEN** a filled frame is dragged and its asset is removed before `dragend`
- **THEN** the drag source node stays mounted long enough for `dragend` to reach `document`
