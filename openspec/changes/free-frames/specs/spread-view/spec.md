## ADDED Requirements

### Requirement: Empty frames are selectable

Clicking an empty frame SHALL select it with the Phase A selection chrome (no photo-selected announcement). An empty selected frame is never a move / swap source: activating another frame selects that frame instead. The selection ends when the frame is removed or gains / loses its photo.

#### Scenario: Select empty, then another

- **WHEN** an empty frame is selected and the user clicks a filled frame
- **THEN** the filled frame becomes selected and no photo moves
