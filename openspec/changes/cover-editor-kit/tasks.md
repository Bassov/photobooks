## Implementation

- [x] 1. `v7.tsx`: `spineCm`, `WRAP` / `HINGE` / `SAFE`, `coverW(b, pages)`; callers in `viewport.tsx`, `chrome.tsx`, `demo-parts/site.tsx`, `demo-parts/presentation.tsx`, `features/site-viewer.tsx` pass the page count (qa "cover-editor: 20 pages" / "120 pages")
- [x] 2. `CoverSpread big` layer stack (sheet, cover, front photo layer, hinges, safe frames, veil, chip ≥ 18 px) and cqw text sizes; the mini cover clips the same photo layer (qa "empty cover", "safe frames", "front photo", "A3 landscape")
- [x] 3. Spine text rule (centred, min size, ellipsis) on canvas and mini covers (qa "spine text centre", "long spine text")
- [x] 4. Cover inspector sub, Spine width and print-profile hint (qa "spine text centre … inspector"; KS10 row tops)
- [x] 5. `viewport.tsx`: sheet camera, labels under the sheet, drop outline on the sheet (qa "labels 10 px under the sheet", KS3)
- [x] 6. `features/pages.tsx`: "120 pages" state and notes (qa "120 pages")
- [x] 7. `qa.mjs`: cover-editor measurements (20 / 120 pages, spine text centre, ellipsis, A3 landscape chip, inspector texts); existing cover checks follow the new layers (`uikit:qa:quick` 401 passed, 0 failed)

## Manual test scenarios

1. Kit `#/full/cover-editor` "New cover": grey front, overlays and chip, no photo layer.
1. Kit `#/full/cover-editor` "Photo + title" at 1440 × 900: sheet with veiled wrap band, hinge strips, two safe frames, chip "Wrap 15 mm"; labels under the sheet.
1. "120 pages": wider spine, spine title still centred.
1. `#/demo`: Book settings → A3, Landscape → Cover: no chip.
1. Cover inspector: a long spine text ends in an ellipsis on the spine.
