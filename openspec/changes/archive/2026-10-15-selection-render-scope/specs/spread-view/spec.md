# Spec Delta

## ADDED Requirements

### Requirement: Selection re-renders a spread only when its labels change

A mounted spread MUST re-render for a gallery or move-source change only when that change alters the frame labels on that spread.

#### Scenario: Another selected photo leaves both spreads idle

- **WHEN** two spreads are mounted and the selected gallery photo changes while a photo stays selected
- **THEN** neither spread's render count increases

#### Scenario: Source moves on the other spread

- **WHEN** two spreads are mounted, a move source is already on the first spread, and that source moves to another frame on the first spread
- **THEN** the second spread's render count does not increase

#### Scenario: Setting a source refreshes the spread

- **WHEN** two spreads are mounted and a move source is set
- **THEN** the second spread's render count increases

#### Scenario: Clearing a source refreshes the spread

- **WHEN** two spreads are mounted and an existing move source is cleared
- **THEN** the second spread's render count increases

#### Scenario: Moving the source onto this spread refreshes it

- **WHEN** two spreads are mounted and the move source moves from the first spread onto a frame on the second spread
- **THEN** the second spread's render count increases

### Requirement: Selection labels stay the same

Frame controls MUST keep their existing names when selection changes: “Place photo” or “Replace photo” while a gallery photo is selected, “Cancel move” on the move-source frame, and “Swap photos” or “Move photo here” on the other frames while a move source exists.

#### Scenario: Gallery selection names place or replace

- **WHEN** a gallery photo is selected
- **THEN** an empty frame is named “Place photo” and a filled frame is named “Replace photo”

#### Scenario: Move source names cancel, swap, or move

- **WHEN** no gallery photo is selected and a move source exists
- **THEN** the source frame is named “Cancel move” and each other frame is named “Swap photos” or “Move photo here”
