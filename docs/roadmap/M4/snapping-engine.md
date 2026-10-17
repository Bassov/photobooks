# snapping-engine

Tag: prep
Milestone: M4
Title: pure snapping

## Scope

- [ ] Snapping engine: trim / bleed edges, margins, grid columns / rows (from `resolveLayoutGrid`), guides, page center, other frames' edges and centers, equal gaps; returns corrected rect + active guide lines
- [ ] Anchor index built once at gesture start; per-move query allocation-free; `pnpm bench` budget per query on a dense spread
