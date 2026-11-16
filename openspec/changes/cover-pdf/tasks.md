## Implementation

- [x] 1. printText: cover row, summary / bleed label with cover bleed, run `Cover · p%`, done cover line, skipped `cover` list (+ unit) — `printText.test.ts`
- [x] 2. printStore: cover unit in the percent, outcome `cover` + `skipped.cover` (+ unit) — `printStore.test.ts`, `PrintButton.test.tsx`
- [x] 3. startPrint: cover photo resolved, cover request and file after the pages, failures, booklets unchanged (+ unit) — `startPrint.test.ts`
- [x] 4. PrintDialog: Cover row, check scope filter, done line and Open pages / Open cover (+ unit) — `PrintDialog.test.tsx`
- [x] 5. CoverView spine = backFill, `--cover-spine` token dropped — `e2e/kit10-cover.spec.ts` paint probe
- [x] 6. e2e print-dialog (A5 row, kit geometry as is, two files, Open cover, booklet no cover) and kit10-cover spine paint

## Manual test scenarios

1. A5 book → Print: Cover row `33.8 × 24 cm · spine 12 mm`; 2-up → `None with booklets`.
2. Export PDF (1 per sheet) → PDF ready shows the cover line, Open pages and Open cover open the two files.
3. Select the cover: the spine paints the back fill colour.
