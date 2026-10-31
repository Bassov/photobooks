## ADDED Requirements

### Requirement: Mouse wheel scrolls the filmstrip sideways

A wheel over the filmstrip SHALL scroll it horizontally (the dominant wheel delta maps to `scrollLeft`) and SHALL NOT scroll the page or change the canvas zoom.

#### Scenario: Vertical wheel over the strip

- **WHEN** the user wheels down over the filmstrip
- **THEN** the strip's `scrollLeft` grows, and the canvas zoom and window scroll are unchanged
