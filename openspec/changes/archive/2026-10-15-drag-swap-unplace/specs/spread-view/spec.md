# Spec Delta

## ADDED Requirements

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
