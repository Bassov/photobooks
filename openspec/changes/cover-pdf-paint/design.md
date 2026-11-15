## Decisions

1. Sheet = existing `coverGeometry` with the effective profile; nothing new from `src/core/print/**`. Page = sheet `{0, 0, sheetW, sheetH}` through `sheetBoxes` / `sheetMatrix`, bleed `marks ? coverBleedMm : 0` (C3).
2. `coverSheetMarks(sheet, bleedMm)` in `pdfGeometry.ts`: `cropMarkSegments` of the sheet + fold segments at x = spine edges, same offset / length as crop marks (C4).
3. `coverPhotoRect(box, imageAspect, crop?, bleedBox?)` in `pdfGeometry.ts` (not `coverLayout.ts`: the `core-is-pure` deps rule bars `src/core` → `src/render`): cover fit × `crop.zoom` at `coverPhotoAnchor(crop)` (`crop.center`, else 45 % / 50 % as the CSS); with `bleedBox`, scaled about the anchor point by the least k ≥ 1 that covers it (C6). `CoverView` takes `background-position` from `coverPhotoAnchor` (same pixels: no UI writes a cover crop yet).
4. Photo: `embedPhotos` of the interior (original bytes, ICC tag, EXIF orientation), drawn via `imageMatrix`, clipped to B'. Missing / unsupported → `skipped`, cloth shows.
5. Text: `loadPdfFonts` + `breakTextLines` / `ellipsize` / `baselineOffset`; `serif*` = Lora upright, `sans` and back = Inter; `serif-italic` sheared 0.25 about each baseline, spine rotated ±90°. Empty → nothing.
6. Worker `{ cover: PdfPaintRequest }` (`PdfCoverWorkerRequest`, outside `PdfWorkerRequest` so `src/editor/print` stays untouched) → chunks, `done { bytes, skipped }` / `failed`.

## Touch-set & Test Plan

| File                                   | Why                                 |
| -------------------------------------- | ----------------------------------- |
| `src/core/pdf/paintCoverPdf.ts`        | new painter                         |
| `src/core/pdf/paintCoverPdf.test.ts`   | boxes, cloth, photo, texts, marks   |
| `src/core/pdf/paintPdf.ts`             | export `embedPhotos` / `cm` / `rgb` |
| `src/core/pdf/pdfGeometry.ts`          | marks, photo rect                   |
| `src/core/pdf/pdfGeometry.test.ts`     | unit                                |
| `src/core/pdf/pdfGeometry.pbt.test.ts` | PBT                                 |
| `src/core/pdf/pdf.worker.ts`           | `cover` request                     |
| `src/core/pdf/pdf.worker.test.ts`      | round trip                          |
| `src/render/CoverView.tsx`             | photo anchor                        |
| `src/render/CoverView.test.tsx`        | anchor test (new case only)         |
| `openspec/specs/print-dialog/spec.md`  | delta (archive)                     |
| `docs/roadmap/P4/cover-pdf-paint.md`   | item                                |

No e2e (no UI); existing cover and interior PDF tests unchanged. Worker only, no new security surface.
