## Implementation

- [x] 1. `frameLookGeometry.ts`: outer / photo / stroke rects with clamped mat, stroke and radius; rounded-rect path; inset-photo matrix (`frameLookGeometry.test.ts`, `frameLookGeometry.pbt.test.ts`)
- [x] 2. `paintPdf.ts`: styled photo frames paint the mat fill, the rounded clip, the inset photo and the stroke; unstyled frames keep today's operators (`paintPdf.look.test.ts`)

## Manual test scenarios

N/A: prep item, no UI (PDF bytes are locked by unit tests).
