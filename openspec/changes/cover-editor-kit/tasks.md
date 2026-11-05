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

Kit-only change: `pnpm agent manual-qa` drives the prod editor-shell, not the kit, so it was not run. Evidence is the kit qa run (headless Playwright, real clicks and fills on `#/full/cover-editor`) plus the `#/demo` baseline walk:

- OK 1: "cover-editor: empty cover": sheet, hinges, safe frames, 4-strip veil (`pointer-events: none`) and chip present; no photo layer.
- OK 2: 20 pages: sheet 848 × 522.45, cover 787.70 × 462.16, spine 24.11, wrap 30.14, hinge 16.06. Safe frames 355.67 × 442.06. Chip 8 px from the sheet edge. Labels 10 px under the sheet.
- OK 3: 120 pages: spine 61.39, sheet height 498.81, wrap 28.77. Spine text centre within 0.01 px of the spine centre.
- OK 4: A3 landscape set through Book settings: sheet 848 × 314.39, band 14.41 px, no chip.
- OK 5: long spine text: `text-overflow: ellipsis`, clipped, box 442.08 px = trim height − 2 × safe; still centred.
- OK `#/demo` baseline capture (77 steps): steps 09 and 13 show the sheet, veil, hinges, safe frames, chip and inspector hint. `ui-review`: no findings. Overlays are `aria-hidden` / non-interactive and there are no new controls.
