## ADDED Requirements

### Requirement: Move spread re-lays changed page roles

`moveSpread` SHALL reapply the template of every spread whose page count changes because of the move (first and last spreads are single-page), keeping its photos.

#### Scenario: First spread moved to the middle

- **WHEN** the first spread is moved to the middle of the book
- **THEN** it becomes a two-page spread laid out with its template and keeps its photos
