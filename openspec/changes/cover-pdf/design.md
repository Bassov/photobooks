## Decisions

1. The Cover row reads `coverGeometry(bookPrintProfile(book), book)` once at dialog open; the cover bleed is `profile.coverBleedMm`, as the painter uses.
2. With 1 per sheet the cover output opens after the pages paint, from the same paint request through the worker `cover` request; both files close under `saving`. A failure aborts the open outputs and fails the run. The pages file of a failed cover stays (the next run replaces it).
3. `resolvePrintPhotos` adds the front cover photo, so the cover painter and the check see it (missing → `cover-asset-missing`, skipped).
4. The cover is one more progress unit in the job store; the outcome carries the cover file, and the skipped row carries a `cover` flag.
5. Spine C5: `.cover-spine` and the sheet gradient's middle stop paint `look.backFill`. The `--cover-spine` token goes from `styles/tokens.css` (no other user; `docs/design.md` never named it). Mini covers are the same `CoverView`.

## Touch-set & Test Plan

| path                                    |
| --------------------------------------- |
| `src/editor/print/PrintDialog.tsx`      |
| `src/editor/print/PrintDialog.test.tsx` |
| `src/editor/print/PrintButton.test.tsx` |
| `src/editor/print/printText.ts`         |
| `src/editor/print/printText.test.ts`    |
| `src/editor/print/printStore.ts`        |
| `src/editor/print/printStore.test.ts`   |
| `src/editor/print/startPrint.ts`        |
| `src/editor/print/startPrint.test.ts`   |
| `src/render/CoverView.tsx`              |
| `src/render/CoverView.css`              |
| `styles/tokens.css`                     |
| `e2e/print-dialog.spec.ts`              |
| `e2e/kit10-cover.spec.ts`               |

- Unit: texts, store percent, runPrint files and failures, dialog §3 lines.
- e2e: A5 row, kit geometry as is, two files, Open cover, booklet without a cover file; canvas spine paint.
