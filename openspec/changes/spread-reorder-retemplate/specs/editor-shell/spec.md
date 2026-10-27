## ADDED Requirements

### Requirement: Reorder spreads in the left panel

The system SHALL let the user reorder spreads by dragging a thumbnail in the left panel (insertion line shown, items shift by `transform`) or with Alt+↑/↓ on a focused item. A reorder SHALL be one history step and the pasteboard SHALL follow the new order. Switching a spread's template SHALL keep its photos in order; photos without a frame in the new template become unplaced.

#### Scenario: Drag reorder

- **WHEN** the user drags the third spread above the first and then presses Undo
- **THEN** the list and pasteboard show the new order after the drop and the old order after Undo

#### Scenario: Template with fewer frames

- **WHEN** a spread with four photos switches to a two-frame template
- **THEN** the first two photos stay in their frames and the other two are unplaced
