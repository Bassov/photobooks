## Design

Touch-set: `src/core/grid/`, `src/core/ops/grid.ts`, `src/core/ops/applyBookOp.ts`, `src/core/schema.ts`, `src/core/templates/catalog.ts`, `src/core/index.ts`, `src/editor/{GridSection,GridOverlay,gridView,gridOverlayModel,Inspector,inspectorModel,bookHistory,bookStore,ConnectedSpreadView}`, `src/render/SpreadView.tsx`, `e2e/layout-grids-settings.spec.ts`.

- **Schema stub, no version bump:** spread `layoutGrid` loosens to a partial override (old full grids still parse). `inside`/`outside` map to v3 `left`/`right`; the page-scoped bump, `resolveLayoutGrid(book, index)` and template mirroring stay in `layout-grids-schema`. The overlay already mirrors per label; template geometry does not yet.
- **Ops:** `setBookGrid` / `setSpreadGrid` / `resetSpreadGrid` clamp (cols/rows 1–12, mm ≥ 0), re-align only templated spreads reading a changed field (`applyTemplate` keeps placements), one history step each. Undo snapshot now includes the book `layoutGrid`.
- **UI:** Inspector Spread | Book tabs, shared `GridSection`; grid visibility is an editor-only store; overlay rendered through a `SpreadView` overlay slot (not in thumbs). Colors: `--field`, `--muted-foreground` only.
- **Scroll:** no page-level scroll; the Inspector keeps its own scrollport.
