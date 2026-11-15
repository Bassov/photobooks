## ADDED Requirements

### Requirement: Cover PDF page

The PDF worker's `cover` request SHALL paint one PDF page of the book's cover sheet (`coverGeometry`, effective profile), titled with the book title and streamed as chunks, then `done { bytes, skipped }` or `failed`. With marks the boxes SHALL be `sheetBoxes(sheetW, sheetH, coverBleedMm, true)` with 8 crop marks and 4 spine fold marks (x = spine edges, outside the bleed); without, MediaBox = BleedBox = TrimBox = the sheet and no marks. Paint order: `backFill` over the bleed box; the front photo (original bytes, EXIF orientation, ICC as the interior) placed by the canvas's `coverPhotoRect`, grown about its anchor to cover the front bleed and clipped to it; back, spine (rotated by direction, cut with "…" past trim height − 2 × safe) and front title texts in the book fonts, empty text drawn as nothing; marks. A missing front photo SHALL be reported in `skipped` and leave the cloth.

#### Scenario: A5 cover boxes

- **WHEN** an A5 book with 20 pages on the generic profile is painted with marks
- **THEN** the TrimBox is 958.11 × 680.31 pt at (22.68, 22.68), the BleedBox 975.12 × 697.32 pt, the MediaBox 1003.46 × 725.67 pt; with marks off all three are 958.11 × 680.31 pt at 0
