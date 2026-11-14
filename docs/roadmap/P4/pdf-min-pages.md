# pdf-min-pages

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item pdf-min-pages
Status: done

## Scope

- [ ] PDF export pads a book below the print profile's minimum page count with blank paper pages
- **Goal:** Book settings promises (book-core "Print profile validates trim and bleed") "{name} prints at least {min} pages; this book’s {n} print as {min}". `paintBookPdf` (`src/core/pdf/paintPdf.ts`) paints only the book's own pages; it appends blank paper pages (same trim + bleed size, crop marks when the profile asks, no content) up to `profile.pageCount.min`
- **Done when:** a 4-page book on a profile with min 20 → the PDF has exactly 20 pages, pages 5–20 blank with the same MediaBox/TrimBox/BleedBox as page 1 (unit test reads the PDF); a book at or above the minimum keeps its page count; PBT: PDF pages = max(pages, min) on `output: 'pages'` profiles; crop marks on the blank pages exactly when `profile.cropMarks`
- **Musts:** count book pages with `pagesOf` (the rule `printIssues` uses), never re-derived; spread-per-sheet profiles pad whole blank sheets up to exactly `min` pages; every `paintBookPdf(` caller listed in the PR body as fixed or left out
- **Hard nos:** no UI; no new dependencies; no edits to `src/core/pdf/pdf.worker.ts`, `src/core/index.ts`, `src/core/print/**`, `src/project/**`, `src/editor/**`, `uikit/**`, `.github/**`; no backward compat (Owner 2026-11-02)
- **Test:** unit + PBT in `src/core/pdf/`; no e2e (PDF bytes only)
- **Browser check:** n/a (PDF bytes only)
- **Depends:** pdf-painter
