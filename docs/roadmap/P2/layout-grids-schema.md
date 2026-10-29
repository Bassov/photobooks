# layout-grids-schema

Tag: prep
Milestone: P2
Title: page layout grids in the document

## Scope

- [ ] Schema version bump with migration: the book layout grid becomes page-scoped and mirrored on facing pages — margins `top / bottom / inside / outside`, `columns`, `rows`, column and row gutters; the per-spread `layoutGrid` becomes a partial override (only the fields it changes); v2 `left / right` map to `outside / inside`
- [ ] Pure `resolveLayoutGrid(book, spreadIndex)` → per-page content box, column and row rects (single first / last pages included), memoized by spread reference; inheritance chain book grid → spread override, written so a parent level can be inserted
- [ ] Templates read margins and gutters from the resolved grid (geometry unchanged for symmetric margins); PBT: cells tile the content box, facing pages mirror
- [ ] `docs/future-architecture.md` "Grids and guides" describes the page-scoped model
- **Done when:** vN migrates every v(N-1) fixture; `resolveLayoutGrid` PBT (cells tile the content box, facing pages mirror) green; template geometry unchanged for symmetric margins
- **Kit components:** none (prep, no UI); reference model: sandbox `uikit/src/sandbox/model.ts:43-70,181` (`effectiveGrid` and `Parent.grid`)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI in this item
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** none
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
