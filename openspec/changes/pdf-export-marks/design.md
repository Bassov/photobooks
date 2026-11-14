## Decisions

1. `PaintPdfInput.marks: boolean` is required (no default). `bleedMm = marks ? printBleedMm(...) : 0` and `sheetBoxes(..., marks)` feed every page, padding pages included; the painter no longer reads `profile.cropMarks`. Off → MediaBox = BleedBox = TrimBox = trim.
2. Optional `onSheet(painted, sheets)` input, called synchronously after each page (book sheets, then blanks); `sheets` = final page count. The worker maps it to `{ progress: { painted, sheets } }` (keyed like `done` / `failed`) via fire-and-forget `postMessage`, so painting never waits on the main thread.
3. `PdfPaintRequest.marks: boolean` is required and passed through. Callers: `pdf.worker.ts` and the paintPdf / worker tests (no production sender yet).

## Touch-set & Test Plan

| File                                  | Why                   |
| ------------------------------------- | --------------------- |
| `src/core/pdf/paintPdf.ts`            | `marks`, `onSheet`    |
| `src/core/pdf/pdf.worker.ts`          | `marks`, `progress`   |
| `src/core/pdf/paintPdf.test.ts`       | marks on / off        |
| `src/core/pdf/paintPdf.color.test.ts` | pass `marks`          |
| `src/core/pdf/paintPdf.look.test.ts`  | pass `marks`          |
| `src/core/pdf/pdf.worker.test.ts`     | `marks`, progress PBT |
| `openspec/specs/book-core/spec.md`    | delta via archive     |

- Unit: marks on, A5, bleed 3 → BleedBox = trim + 6 mm, 8 crop-mark segments per page; marks off (profile asks for marks) → MediaBox = TrimBox = trim, no line paths, padding included.
- PBT (worker): spreads × profile minimum → `sheets` progress messages, `painted` 1..sheets, then `done`.
- e2e: none (no UI).
