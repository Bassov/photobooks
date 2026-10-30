## ADDED Requirements

### Requirement: Spread guide ops

Book ops SHALL add, move and remove a spread guide (`addGuide`, `moveGuide`, `removeGuide`) as undoable steps. Offsets MUST round to 0.1 mm; an unknown spread, a taken id or a non-finite offset MUST leave the book unchanged; a locked guide MUST NOT move or be removed.

#### Scenario: Add then remove restores the list

- **WHEN** a guide is added to a spread and then removed by id
- **THEN** the spread's guides equal the original list
