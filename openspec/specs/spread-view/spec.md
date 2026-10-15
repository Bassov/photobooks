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

Spreads outside the near-viewport window MUST NOT be mounted. The scroll extent MUST still represent the full stack, and the mounted window MUST cover the visible scrollport while more spreads remain beyond it.

#### Scenario: Mid-scroll window covers the port

- **WHEN** the user scrolls the fixture pasteboard to the middle and more spreads remain below
- **THEN** mounted spreads cover the visible scrollport and the mounted count stays below the full stack

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

The pasteboard SHALL be the vertical scrollport for the spread stack. The document MUST NOT gain page-level horizontal or vertical scroll.

#### Scenario: Scroll stays inside the pasteboard

- **WHEN** the fixture stack is taller than the workspace
- **THEN** the pasteboard scrolls vertically and the document element does not scroll
