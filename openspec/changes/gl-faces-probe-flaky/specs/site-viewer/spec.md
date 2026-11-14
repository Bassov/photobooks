## MODIFIED Requirements

### Requirement: Lazy GL book renderer

The site SHALL ship the stand's WebGL book (closed book, open book, page curl; three r170 vendored) only in lazily imported chunks: the `site` entry and its static imports SHALL stay ≤ 200 KB of gzipped script and contain no GL module. The renderer SHALL take a GL-local input (cover panels, cloth, page count, trim, paper default `#FBFAF7`, endpaper default `#E9E4DA`, a face provider); the thickness SHALL follow the stand's rule for the page count plus two endpapers. Faces SHALL be painted with the page painter lazily, pages of the focused view and views ± 2 first, grain after painting, one page at a time, never in the requesting task: painting (clipped) and grain SHALL each go one row band per task (endpaper grain too), with no long task over 50 ms for 6 faces at 2×.

#### Scenario: Face order

- **WHEN** faces of pages 0, 9 and 4 are requested and view 3 is focused
- **THEN** page 4 paints before pages 0 and 9
