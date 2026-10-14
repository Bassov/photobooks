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

### Requirement: Painter fixture on query

When the URL query `fixture=painter` is present, the system SHALL load an in-memory book of 40 spreads on the 4-grid template with four frames each, leave the first frame of the first spread empty, supply synthetic previews for the other frames, and paint every spread in the workspace.

#### Scenario: Fixture paints forty spreads

- **WHEN** the app opens with `fixture=painter`
- **THEN** the workspace shows 40 painted spreads and the first spread's first frame is an empty placeholder

### Requirement: Fixture workspace scrollport

With the painter fixture loaded, the workspace SHALL be the vertical scrollport for the spread stack. The document MUST NOT gain page-level horizontal or vertical scroll.

#### Scenario: Scroll stays inside the workspace

- **WHEN** the fixture stack is taller than the workspace
- **THEN** the workspace element scrolls vertically and the document element does not scroll

### Requirement: Default workspace stays a placeholder

Without `fixture=painter`, the workspace SHALL keep its placeholder and MUST NOT paint the fixture book.

#### Scenario: Normal visit

- **WHEN** the user opens the app without `fixture=painter`
- **THEN** the workspace placeholder is visible and no spread is painted
