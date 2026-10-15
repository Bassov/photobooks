# Spec Delta

## ADDED Requirements

### Requirement: Drop hover marks one frame

While a gallery photo is dragged across the pasteboard, at most one frame SHALL carry the drop-hover attribute. That attribute MUST change only when the pointer moves onto a different frame. The drag payload MUST identify the gallery asset and MUST NOT carry file bytes.

#### Scenario: Hover follows the pointer

- **WHEN** a gallery photo is dragged from one frame onto another
- **THEN** only the frame under the pointer has the drop-hover attribute

#### Scenario: Hover clears off a frame

- **WHEN** a gallery photo is dragged from a frame onto pasteboard space that is not a frame
- **THEN** no frame has the drop-hover attribute
