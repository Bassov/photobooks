# layout-grids-schema

Tag: prep
Milestone: M4
Title: page layout grids in the document

## Scope

- [ ] Schema version bump with migration: the book layout grid becomes page-scoped and mirrored on facing pages — margins `top / bottom / inside / outside`, `columns`, `rows`, column and row gutters; the per-spread `layoutGrid` becomes a partial override (only the fields it changes); v2 `left / right` map to `outside / inside`
- [ ] Pure `resolveLayoutGrid(book, spreadIndex)` → per-page content box, column and row rects (single first / last pages included), memoized by spread reference; inheritance chain book grid → spread override, written so a parent level can be inserted
- [ ] Templates read margins and gutters from the resolved grid (geometry unchanged for symmetric margins); PBT: cells tile the content box, facing pages mirror
- [ ] `docs/future-architecture.md` "Grids and guides" describes the page-scoped model
