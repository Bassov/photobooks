# book-core-schema

Tag: prep
Milestone: M1
Title: pure book document in `src/core`

## Scope

- [x] Zod schema v1: book settings (trim size mm, bleed, safe margin), layout grid (margins, columns, rows, gutters) and guides (book-level, per-spread), assets, per-book gallery (ordered asset ids), spreads, frames (rect mm, z, assetId?, crop)
- [x] Parse / serialize, `schemaVersion`, migration chain scaffold, reject newer versions
- [x] Invariants: no dangling asset refs, every placed asset is in the gallery; PBT round-trip
- [x] Immutable updates with structural sharing (unchanged spreads keep their reference)
- [x] dependency-cruiser `core-is-pure`; update `.cursor/rules/data-model.mdc` and `AGENTS.md` module map
