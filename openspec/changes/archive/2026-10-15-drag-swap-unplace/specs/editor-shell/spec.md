# Spec Delta

## ADDED Requirements

### Requirement: Swap or move between frames

The editor SHALL swap the placements of two frames when a filled frame is dropped on another filled frame, including a frame on another spread. Dropping a filled frame on an empty frame SHALL move the placement. Dropping a frame on itself MUST NOT change the book. Each accepted drop MUST apply one document operation. Both photos MUST remain in the filmstrip.

#### Scenario: Swap two filled frames

- **WHEN** a filled frame is dropped on another filled frame
- **THEN** the two frames exchange photos, both photos remain in the filmstrip, and both filmstrip items show a Placed badge

#### Scenario: Move onto an empty frame

- **WHEN** a filled frame is dropped on an empty frame
- **THEN** the source frame is empty, the target frame shows that photo, and that filmstrip item still shows a Placed badge

#### Scenario: Drop on the same frame

- **WHEN** a filled frame is dropped on itself
- **THEN** every frame stays as it was

### Requirement: Unplace onto the filmstrip

The editor SHALL clear a filled frame when that frame is dropped on the filmstrip. The photo MUST remain in the filmstrip. The Placed badge MUST disappear when that photo has no placements left.

#### Scenario: Unplace the only placement

- **WHEN** a frame holding a photo with no other placement is dropped on the filmstrip
- **THEN** that frame is empty, the photo remains in the filmstrip, and that filmstrip item has no Placed badge

### Requirement: Keyboard swap, move, and unplace

With no gallery photo selected, the editor SHALL let a keyboard user mark a filled frame as the move source, then swap or move by activating another frame, or unplace with a filmstrip control. A selected gallery photo MUST still place or replace and MUST clear the move source. The move source MUST be the only pressed frame.

#### Scenario: Keyboard swap

- **WHEN** no gallery photo is selected, a filled frame named “Select photo to move” is activated, and another filled frame named “Swap photos” is activated
- **THEN** the two frames exchange photos and both Placed badges stay

#### Scenario: Keyboard move

- **WHEN** a move source is set and an empty frame named “Move photo here” is activated
- **THEN** the source frame is empty, the target shows the photo, and the Placed badge stays

#### Scenario: Keyboard unplace

- **WHEN** a move source is set and the filmstrip control named “Unplace” is activated
- **THEN** the source frame is empty, the photo remains in the filmstrip, and the Placed badge is removed when that photo has no other placement

#### Scenario: Gallery selection still replaces

- **WHEN** a gallery photo is selected and a filled frame is activated
- **THEN** that frame shows the selected photo and is named “Replace photo”

### Requirement: Rearrange keeps page scroll inside existing ports

Swapping, moving, or unplacing MUST NOT create page-level horizontal or vertical scroll. Horizontal scrolling MUST stay inside the filmstrip, and vertical scrolling MUST stay inside the pasteboard.

#### Scenario: Document stays contained after unplace

- **WHEN** a photo is unplaced from a frame
- **THEN** the document has no page-level horizontal or vertical scroll

## MODIFIED Requirements

### Requirement: Empty gallery shows no placements

When the gallery is empty, the filmstrip MUST NOT show a Placed badge or an Unplace control, and activating a frame MUST leave every frame a placeholder named “Place photo”.

#### Scenario: Empty gallery activation

- **WHEN** the gallery has no photos and a frame is activated
- **THEN** no Placed badge is shown, no Unplace control is shown, and every frame remains a placeholder named “Place photo”
