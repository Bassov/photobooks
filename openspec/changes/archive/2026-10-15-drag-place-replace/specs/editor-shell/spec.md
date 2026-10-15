# Spec Delta

## ADDED Requirements

### Requirement: Place and replace from the gallery

The editor SHALL place a selected gallery photo into an empty frame and SHALL replace a filled frame's photo, either by dropping that photo on the frame or by keyboard activation of the frame. Each drop or activation MUST apply one document operation. The photo MUST remain in the filmstrip.

#### Scenario: Place on an empty frame

- **WHEN** a gallery photo is placed on an empty frame
- **THEN** that frame shows the photo, the photo remains in the filmstrip, and that filmstrip item shows a Placed badge

#### Scenario: Replace a filled frame

- **WHEN** a second gallery photo replaces the photo in that frame and the first photo has no other placement
- **THEN** the frame shows the second photo, the first filmstrip item has no Placed badge, the second filmstrip item shows a Placed badge, and both photos remain in the filmstrip

#### Scenario: Keyboard activation without a selection

- **WHEN** no gallery photo is selected and a frame is activated from the keyboard
- **THEN** every frame stays as it was

### Requirement: Empty gallery shows no placements

When the gallery is empty, the filmstrip MUST NOT show a Placed badge, and activating a frame MUST leave every frame a placeholder.

#### Scenario: Empty gallery activation

- **WHEN** the gallery has no photos and a frame is activated
- **THEN** no Placed badge is shown and every frame remains a placeholder

### Requirement: Place and replace keep page scroll inside existing ports

Placing or replacing a photo MUST NOT create page-level horizontal or vertical scroll. Horizontal scrolling MUST stay inside the filmstrip, and vertical scrolling MUST stay inside the pasteboard.

#### Scenario: Document stays contained after place

- **WHEN** a gallery photo is placed on a frame
- **THEN** the document has no page-level horizontal or vertical scroll
