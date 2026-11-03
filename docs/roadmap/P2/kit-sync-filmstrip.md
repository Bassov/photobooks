# kit-sync-filmstrip

Tag: feature
Milestone: P2
Title: Bug: Kit sync W5: filmstrip header Unplaced toggle + sort menu (Designer kit-sync Spec)
Status: done

## Scope

- [ ] KS13: the `#/demo` filmstrip dock header shows prod's chips (`src/editor/FilmstripDock.tsx`, tested in `FilmstripSortFilter.test.tsx`) left of "Add folder…": "Unplaced" toggle (filter icon, x 783.92, 90.75 × 28, 12 / 500 rgb(83, 81, 82), padding 0 8) and the sort menu "Added order" (arrow-up-down icon + chevron-down, x 882.67, 127.08 × 28, 12 / 400, padding 0 8); "Add folder…" stays x 1017.75, 110.25 × 28; all three radius 9999 (Decided P2), 8 apart; the Relink chip stays (left of the chips, only while photos are missing)
- [ ] KS13: Unplaced filters the kit filmstrip to photos not placed in the book and the head reads "Photos · N of M · K used" (prod); when every photo is placed the strip shows "Every photo is placed. Turn off “Unplaced” to see all."
- [ ] KS13: the sort menu opens above the chip (prod `placement="top end"`, min width 160) with prod's options Date taken · File name · Added order; `#/demo` starts on "Added order" (prod default); picking one re-sorts the strip and relabels the chip
- **Browser check:** `uikit#/demo` editor at 1440 × 900: the dock header reads Unplaced · Added order ⌄ · Add folder…; Unplaced on → only unplaced photos and "N of M"; the sort chip opens Date taken / File name / Added order.
- **Demo:** `uikit#/demo` steps that show the dock header (walk in `uikit/scripts/demo-capture.mjs`); baselines regenerated
- **Test:** kit `uikit/scripts/qa.mjs` appends one KS13 assertion per number (x / w / h / radius, font size / weight / colour, padding), the filter and the menu options
- **Hard nos:** kit-only (`uikit/`); no `src/` change; `uikit/src/sandbox/v7.tsx`, `context-inspector.tsx`, `sections.tsx` untouched; qa / capture scripts only appended
- **UI kit:** `uikit#/demo`; Designer Spec `photobooks-orch/shared/design/kit-sync/spec.md` item 13 (Decided P2); tracker KS13
