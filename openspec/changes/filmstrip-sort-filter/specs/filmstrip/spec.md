## ADDED Requirements

### Requirement: Gallery sort and unplaced filter

The filmstrip dock SHALL offer sort by capture time (asset `capturedAt`, else file mtime, undated last), name, or added order, and an "Unplaced only" filter that hides photos placed on any frame. Sort/filter MUST NOT reorder or mutate the book gallery, MUST update inside a transition, and MUST keep scrolling inside the filmstrip scrollport. An empty filtered view MUST show "All photos are placed."

#### Scenario: Unplaced only shrinks as the book fills

- **WHEN** "Unplaced only" is on and a gallery photo is placed
- **THEN** that photo leaves the list and the dock count reads "N of M"

### Requirement: Remove photo from gallery

The system SHALL remove a gallery photo via × on its thumb or Delete/Backspace on the selected thumb. A placed photo MUST first ask in an AlertDialog and empty its frames on confirm; an unplaced photo is removed immediately with a status-line message. The file on disk MUST NOT be touched.

#### Scenario: Placed photo asks first

- **WHEN** the user removes a placed photo and confirms
- **THEN** it leaves the gallery and its frame is empty
