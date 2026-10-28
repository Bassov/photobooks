# layout-grids-settings

Tag: feature
Milestone: M4
Title: margins, columns, rows, gutters
Status: done

## Scope

- [ ] Grid section in a book setup `Panel` (form primitives): margins (top / bottom / inside / outside), columns, rows, column and row gutters
- [ ] Per-spread override of single fields with "Reset to book grid"; template-driven spreads re-align, placements kept; one history step per edit
- **Perf:** a grid edit re-resolves only spreads using that grid; field scrubbing previews through transient state and commits once. Gate: scrub the gutter field on the fixture book — zero LoAF.
- **Browser check:** set a 12-column grid with a wider inside margin — template frames follow and facing pages mirror; override one spread's columns and reset it.
- **UI ref:** `uikit#/feature/layout-grids-settings`
- **UI kit:** `uikit/src/features/m4.tsx:51-54` (`layout-grids-settings` demo + notes), `UI ref: uikit#/feature/layout-grids-settings` — book/spread grid settings form, `uikit/src/sandbox/inspector.tsx`, `uikit/src/components/ui/numberfield.tsx`
