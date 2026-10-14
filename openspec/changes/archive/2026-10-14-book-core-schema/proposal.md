# Proposal

## Problem

There is no pure book document model. Editor features (filmstrip, pasteboard, persistence) have nothing to parse, version, or update immutably. The outdated `book → spreads → pages → slots` guidance in agent docs conflicts with the target architecture.

## Why now

First M1 document-model prep item in `docs/roadmap.md`. Every later layout and editor change depends on a stable Zod schema, migration boundary, and structural-sharing updates in `src/core`.

## Scope in

- Zod schema v1 for book settings, layout grid, guides (book-level and optional per-spread overrides), assets, gallery, spreads, and frames (mm; crop as zoom + center)
- Parse / serialize, integer `schemaVersion`, migration chain scaffold, reject newer versions
- Load-boundary invariants: no dangling asset refs; every placed asset is in the gallery; PBT round-trip
- Immutable update helpers with structural sharing (unchanged spreads keep their reference)
- dependency-cruiser `core-is-pure`; update `data-model.mdc` and `AGENTS.md` module map

## Scope out

- Templates, `resolveSpread`, place/unplace/swap ops, selectors, benches (`layout-geometry`)
- UI, File System Access, workers, persistence adapters

## Capabilities

### New Capabilities

- `book-core`: pure book document schema, parse/migrate boundary, invariants, and structural-sharing updates

### Modified Capabilities

- (none)

## Success criteria

- Valid v1 books parse and serialize losslessly (PBT round-trip)
- Newer `schemaVersion` is rejected; migration scaffold runs for current version
- Invariant violations fail at the parse boundary
- Updating one spread leaves other spread object identities unchanged
- `pnpm deps` enforces `core-is-pure`; `AGENTS.md` and `data-model.mdc` describe the new model

## Risks

- Over-specifying asset metadata in v1 could force migrations before storage exists — keep assets minimal (`id` only)
- Invariant checks must stay pure and cheap; heavy validation belongs at load boundaries only
