## ADDED Requirements

### Requirement: Phone slide list

The system SHALL derive a book's phone slides from its spreads (parent frames included): one slide per page with any frame on it, blank pages and endpapers skipped, and a two-page spread as one whole slide when any frame crosses the gutter.

#### Scenario: Panorama and blank page

- **WHEN** a book has a spread whose frame crosses the gutter and a page with no frames
- **THEN** the panorama spread is one whole slide and the blank page has no slide
