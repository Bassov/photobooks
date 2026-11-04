## ADDED Requirements

### Requirement: Text tool creates text frames

With the Text tool, a press on paper or over an image frame SHALL draw a text frame. A drag of 3 px or more uses the snapped frame draft (min 10 × 4.5 mm). A click adds 60 × 14 mm at the snapped point, clamped to the page's 6 mm safe area. The new frame is empty Caption / left text; editing starts at once and the tool returns to Select.

#### Scenario: Click creates and an empty frame is removed

- **WHEN** the user clicks the paper with the Text tool, then presses Esc without typing
- **THEN** a 60 × 14 mm text frame was editing and is now gone, and Undo restores the step before it

### Requirement: Text frame editing and history

Double-click, Enter (one text frame selected) or a Text press SHALL edit a text frame, caret at the end; Esc or Ctrl/⌘+Enter commits and keeps it selected. Typing grows the box to whole lines, capped at the paper. An empty frame created in that session is removed on exit with no history step. Create plus first edit is one "Add text" step, each later session one "Edit text". Text frames are never photo drop or swap targets or sources.

#### Scenario: Create and type is one step

- **WHEN** the user creates a text frame, types `Lake` and presses Esc
- **THEN** the frame shows `Lake` and stays selected, and one Undo removes the frame

### Requirement: Text overflow and Text inspector

A text frame whose content exceeds its whole-line box SHALL show the `Overflow` chip (`text-overflow-chip`, constant screen size) in the editor only, hidden while it is edited. A selected text frame SHALL open the Text inspector (Style, Align, Text, Position & size, Arrange, Delete frame), with the meta `Text overflows the frame` while it overflows.

#### Scenario: Title restyle overflows

- **WHEN** a 60 × 14 mm frame holding a caption sentence is set to Title in the inspector
- **THEN** the chip and the meta show in the editor, and Preview shows no chip
