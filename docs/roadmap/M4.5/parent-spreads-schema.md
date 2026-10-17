# parent-spreads-schema

Tag: prep
Milestone: M4.5
Title: parent spreads in the document

## Scope

- [ ] Schema version bump with migration: parent spreads with shared items, an optional partial layout grid and guides; `spread.parentId?` and a book default parent; page-number items on parents (auto page number) with the book's numbering options (start number, skip first page, format)
- [ ] Per-spread parent overrides: `spread.parentOverrides?` with hidden parent item / guide ids and local copies linked to the parent item or guide they override (`overridesId`); the spread's own items and guides are added on top
- [ ] Resolver: grid chain book grid → parent → spread override (the book grid applies to parent "None"); guides = parent guides minus hidden / overridden + spread guides; parent items beneath spread items minus hidden / overridden; PBT
