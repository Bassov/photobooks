# Proposal

## Problem

Book assets are empty objects keyed by id. M2 persistence, relink, and content-addressed caches need durable identity fields on each asset (source root, relative path, size, mtime, hash). Without a schema bump and migration, later items invent ad-hoc shapes or break saved books.

## Why now

Next unchecked roadmap item after `session-state`. `asset-identity`, `derived-cache-opfs`, `open-save-project`, and `missing-assets-relink` depend on asset records in `book.json`.

## Scope in

- Schema version bump with a pure migration from v1 empty assets to the new asset record
- Asset record fields: source root id, relative path, size, mtime, hash (optional until hashed)
- Parse/serialize, invariants, fixtures, and tests updated for the new version
- No UI

## Scope out

- `AssetSource` adapters, SHA-256 worker hashing, matching/relink logic (`asset-identity`)
- OPFS derived cache, open/save UI, missing-assets UX
- Changing gallery order or placement ops beyond accepting the new asset shape

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `book-core`: asset values become identity records; current `schemaVersion` advances; v1 documents migrate

## Success criteria

- Supported `schemaVersion` advances by one bump to 2
- v1 books migrate losslessly for non-asset fields; each former empty `{}` asset becomes a v2 record with identity fields absent/optional (no invented source root, path, size, mtime, or hash)
- Parse rejects malformed asset records; assets remain id-keyed with no File/Blob/handles
- Round-trip and referential invariants still hold; gallery/placement ops work with the new shape
- No UI; `src/core` stays pure

## Risks

- Migration must not invent fake identity metadata for v1 empty assets — all of source root, path, size, mtime, and hash stay unset until `asset-identity` / open-save fills them
- Broad fixture churn across core/tests — keep defaults in shared factories
- One-subsystem budget: schema bump + asset record only; no hashing workers or FSA
