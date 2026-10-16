# Proposal

## Problem

Asset records in `book.json` can store identity fields, but nothing yet reads photo folders, computes content hashes, or matches records to scanned files. Without a domain `AssetSource` and pure relink matching, open/save and missing-assets flows would invent ad-hoc FSA and hash logic.

## Why now

Next unchecked roadmap item after `asset-record-schema`. `derived-cache-opfs`, `open-save-project`, and `missing-assets-relink` need content-addressed identity and a shared source contract.

## Scope in

- Domain `AssetSource`: read-only originals and folder scan; memory + File System Access adapters; shared contract-test suite
- SHA-256 hashing in a worker at lowest priority; size + mtime as the fast path before hashing
- Pure matching / relink function over asset records and scan results
- No UI

## Scope out

- OPFS `DerivedCache` (`derived-cache-opfs`)
- Open/save UI, autosave, permissions UX, missing-assets UI
- Wiring import/gallery to populate identity fields in the live editor (later `open-save-project`)
- Renaming or removing the session `File` map in `src/photo/assetSources.ts`

## Capabilities

### New Capabilities

- `asset-source`: domain contract for photo-folder originals and scans, worker hashing with size/mtime fast path, and pure match/relink — verified by memory + FSA adapters and a shared contract suite

### Modified Capabilities

- `book-core`: tighten `contentHash` to a SHA-256 hex digest when present (optional fields otherwise unchanged)

## Success criteria

- Callers scan a registered source root and read originals through `AssetSource` without seeing platform handles on the domain API
- Hashing runs off the main thread at lowest priority; size + mtime can skip full hash when they already match a known record
- Pure match/relink maps scanned files to asset records by content hash, with a documented size/mtime/path fallback
- Memory and FSA adapters both pass the shared contract suite
- When present, `contentHash` is a 64-char hex SHA-256; empty/`{}` assets still parse
- **Assumption:** no shipped producers write `contentHash` yet (post–`asset-record-schema`), so tightening the v2 parse contract in place needs no schemaVersion bump
- No UI; `src/core` stays pure

## Risks

- **Security:** File System Access handles and worker `postMessage` (file bytes / hashes) — handles must stay adapter-internal; workers must not receive directory handles
- Size budget: one subsystem (`AssetSource` + hashing + match); keep touch-set lean and reuse existing FSA fakes / worker patterns; split FSA only if apply clearly exceeds ~1000 LOC
- Must not confuse domain `AssetSource` with the session `File` retain map in `src/photo`
