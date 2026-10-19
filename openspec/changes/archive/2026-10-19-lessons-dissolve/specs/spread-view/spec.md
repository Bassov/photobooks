## ADDED Requirements

### Requirement: Drag source stays mounted through drop

While a filled-frame drag is in progress, the drag source element MUST remain mounted until `dragend` so the document-level gesture listener can clear click-suppression state. The painter MUST NOT unmount that source solely because the frame emptied mid-drop.

#### Scenario: Emptying a frame mid-drop keeps the source mounted

- **WHEN** a filled frame is dragged and its asset is removed before `dragend`
- **THEN** the drag source node stays mounted long enough for `dragend` to reach `document`
