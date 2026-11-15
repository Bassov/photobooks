## Implementation

- [x] 1. `printCheck.ts`: `printSummary` + cover, `printProgress` cover unit, `coverCheckRows` + `scope`, `pageList` cover token, bleed label helper, cover file name (e2e `kit-pdf-export` cover-pdf tests).
- [x] 2. `dialogs.tsx` PrintDialog: Cover row, booklet filter, run text, done line + Open pages / Open cover (e2e `cover-pdf options`, `PE3 run`).
- [x] 3. `pages.tsx` `pdf-export`: `Cover check` scenario, run label/notes (e2e `cover-pdf #/feature/pdf-export`).
- [x] 4. `v7.tsx` spine #3E3C3B (e2e `cover-pdf C5`).
- [x] 5. e2e: `kit-pdf-export.spec.ts` new/updated checks (19 passed locally).

## Manual test scenarios

1. `#/full/pdf-export` Issues: Cover row `42.2 × 26 cm · spine 12 mm`; 2-up: `None with booklets`.
2. `Cover check`: three cover rows after the page rows of the same severity, no page list.
3. `#/demo` Print → Export PDF → done: two lines, Open pages / Open cover / Done.
