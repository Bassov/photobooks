## MODIFIED Requirements

### Requirement: Saved layouts apply from percent slots

A saved layout SHALL be stored as slots in percent of the trim it was saved on (the image frames of a spread, top-down in z order) with that spread's page count (`pages` 1 or 2), and applied by scaling the slots to the target spread's trim, keeping photos by index and setting the spread's template id to the saved id. Applying a saved layout whose `pages` differs from the target spread's page count MUST return the book unchanged. Saved ids MUST never clash with catalog template ids.

#### Scenario: Apply a saved layout to a wider spread

- **WHEN** a single-slot two-page layout `{x 0, y 0, w 62, h 100}` is applied to a 600 × 300 mm spread holding one photo
- **THEN** the spread has one frame of 372 × 300 mm at the origin with that photo

#### Scenario: A spread layout on a single page

- **WHEN** a layout saved with `pages` 2 is applied to page 1
- **THEN** the book is returned unchanged
