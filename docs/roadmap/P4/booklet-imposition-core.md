# booklet-imposition-core

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item booklet-imposition-core
Status: done

## Scope

- [ ] Pure `src/core/print/imposition.ts`: 2-up saddle-stitch sheet order (pad to a multiple of 4, blanks before the back cover), 4-up duplex sheet order (pad to a multiple of 8), sheet count; PBT for N in 1..200: each page once, fold order 1..N, minimal padding
- [ ] `src/core/pdf/imposePdf.ts`: imposed sheet PDF from the page PDF (embedded pages, sheet = 2× / 4× page, no photo re-render); 8 / 13 pages → 2-up 2 / 4 sheets, 4-up 1 / 2 sheets
- [ ] PDF worker `impose` request: progress per sheet, then done / failed; `paint` / `check` unchanged
- **Browser check:** none (no UI; the Print dialog options and the perf scenario come with `booklet-imposition`)
