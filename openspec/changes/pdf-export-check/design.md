## Decisions

1. Worker request = `{ paint } | { check }`; `runPdfCheck` posts one `{ checked: { rows } }` or `{ failed }`.
2. Colour read: `readSourceColor(blob.slice(0, 256 KB))` per placed photo, never the whole blob.
3. `preflight.ts` exports `photoPages(book)` on the same printed-item loop, so the colour row's pages follow the preflight page rule.
4. `preflightRows({ issues, colors, profile })` is pure: one row per rule, the colour row after `dpi-below-warn`.
5. `pdfFileName(title, trimMm)` (core/print) keeps its own copy of the kit `PRESETS` ids and sizes (core and its tests must not import `src/editor`, dependency-cruiser `core-is-pure`).
6. `writeExport(root, name, bytes)` in `src/project/fsa/writeExport.ts` on a File System Access subset, outside `LibraryStorage` (handle-free API). NotAllowed/Security → access, Quota → full, else other.

## Touch-set & Test Plan

| Path                                       | Why                        |
| ------------------------------------------ | -------------------------- |
| `src/core/print/preflight.ts`              | `photoPages`, shared loop  |
| `src/core/print/preflightText.ts`          | rows, texts, page lists    |
| `src/core/print/pdfFileName.ts`            | D8 name rule               |
| `src/core/pdf/pdf.worker.ts`               | `check` request, dispatch  |
| `src/project/fsa/writeExport.ts`           | `exports/` write           |
| `src/core/print/preflightText.test.ts`     | unit                       |
| `src/core/print/preflightText.pbt.test.ts` | PBT                        |
| `src/core/print/pdfFileName.test.ts`       | unit (every preset)        |
| `src/core/print/preflight.test.ts`         | `photoPages`               |
| `src/core/pdf/pdf.worker.test.ts`          | check: Adobe RGB, ≤ 256 KB |
| `src/project/fsa/writeExport.test.ts`      | in-memory folder           |

Reuse: `colorJpeg` + `ADOBE_RGB_ICC`, `createMemorySiteDirectory`, `makeBook`. No e2e (no UI).
