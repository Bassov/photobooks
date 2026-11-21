## ADDED Requirements

### Requirement: Fill book op

The system SHALL provide `planFillBook(book, assetIds, maxPages)` and op `fillBook` (`assetIds`, `templates`, `maxPages`) as one book op. Ids are kept in caller order, limited to gallery photos placed nowhere (spreads, local copies, cover, endpapers). They go, in order, into the empty own photo frames (not locked, not text, no photo) of the spreads before the last one, in reading order (left page then right page, top rounded to 1 mm, then left); then onto new best-fit spreads of 2 photos each (the last may take 1) inserted before the last page while the page count stays within `maxPages`; then into the last page's empty frames. Photos that do not fit stay unplaced (the tail of the order). Filled frames, cover, endpapers and master items stay unchanged, and the plan's counts equal the result.

#### Scenario: New book and twelve photos

- **WHEN** a book with spreads `1`, `2–3`, `4` (1, 2 and 1 empty frames) is filled with 12 unplaced photos and a 120-page limit
- **THEN** 4 photos go into frames and 8 onto 4 new spreads, the book reads `1, 2–3, … 10–11, 12` (12 pages), and page 12 holds the 12th photo
