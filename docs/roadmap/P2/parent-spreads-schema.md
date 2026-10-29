# parent-spreads-schema

Tag: prep
Milestone: P2
Title: parent spreads in the document

## Scope

- [ ] Schema version bump with migration: parent spreads with shared items, an optional partial layout grid and guides; `spread.parentId?` and a book default parent; page-number items on parents (auto page number) with the book's numbering options (start number, skip first page, format)
- [ ] Per-spread parent overrides: `spread.parentOverrides?` with hidden parent item / guide ids and local copies linked to the parent item or guide they override (`overridesId`); the spread's own items and guides are added on top
- [ ] Resolver: grid chain book grid → parent → spread override (the book grid applies to parent "None"); guides = parent guides minus hidden / overridden + spread guides; parent items beneath spread items minus hidden / overridden; PBT
- **Done when:** vN migrates every v(N-1) fixture; parent resolution PBT green
- **Kit components:** none (prep, no UI); reference model: sandbox `uikit/src/sandbox/model.ts:43-70,181` (`Parent{frames,guides,grid,pageNumbers}`, `Frame.overrides` and `allGuides`)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** layout-grids-schema
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
