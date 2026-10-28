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
- **Kit components:** `GridSection` (`uikit/src/sandbox/sections.tsx`), `MmField` (`uikit/src/sandbox/inspector.tsx`), `InspectorPanel` Book/Spread tabs (`uikit/src/sandbox/inspector.tsx`), `Section` / `IconButton` (`uikit/src/components/app/ui.tsx`)
- **Demo:** `layout-grids-settings` → `uikit/src/features/m4.tsx`
- **Musts:**
  - Book + Spread only (no parent / Masters). Section title "Layout grid"; summary `cols×rows`.
  - 2-col quiet MmFields: Top / Bottom / Inside / Outside mm; Columns; Rows; Column gutter; Row gutter. Cols / rows clamp 1–12; others ≥ 0.
  - Header eye toggles the overlay (Ctrl+' ok with render-snap). Quiet gray when on.
  - Spread: per-field BOOK | SPREAD source label (quiet gray 2xs uppercase). Ghost "Reset to book grid" when any override.
  - Note: "Facing pages are mirrored: inside = spine side."
- **Hard nos:** no blue / accent on source labels; no Guides / rulers / Frame tool; no parent grid; no Templates tab; black not on fields.
- **Tokens:** field `#D7D7D7`; source text muted gray (not accent).
- **Test:** Book → change Columns → summary updates; Spread override → SPREAD label + Reset enables.
- **Depends:** layout-grids-schema (prep)
