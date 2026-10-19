# book-core Specification

## Purpose

Defines the pure book document model: schema versioning, parse/serialize boundaries, referential invariants, and structural-sharing updates used by later editor and layout features.

## Requirements

### Requirement: Book document schema v1

The system SHALL represent a photobook as a pure, serializable document with integer `schemaVersion` 3, an optional book `title` string (may be empty when present), book settings (trim size in mm, bleed, safe margin), a book-level layout grid (margins, columns, rows, gutters in mm), book-level guides, an assets map keyed by asset id, an ordered gallery of unique asset ids, and an ordered list of spreads. Each spread SHALL contain frames (rect in mm, z-order, optional asset id, optional crop) and MAY override layout grid and guides. Crop SHALL be `{ zoom ≥ 1, center: { x, y } }` in normalized source coordinates. Asset identity SHALL be the map key (values carry no duplicate id field). Each asset value SHALL be an asset record (see Asset record fields and Asset metadata fields). Assets SHALL be referenced by id only (no File, Blob, or handles). The document SHALL NOT store a separate `pages` collection.

#### Scenario: Minimal valid book parses

- **WHEN** a JSON document matching the current schema with empty gallery, omitted `title`, and at least one spread is parsed
- **THEN** the system returns a typed book document with `schemaVersion` 3 and no invented `title`

#### Scenario: Frame crop shape

- **WHEN** a frame includes crop data
- **THEN** zoom is at least 1 and center coordinates are finite numbers in normalized source space

#### Scenario: Book title retained

- **WHEN** a document includes a non-empty `title` string
- **THEN** parse accepts the document and retains that `title`

### Requirement: Parse and serialize round-trip

The system SHALL parse unknown input into a book document (or a typed failure) and SHALL serialize a valid book to JSON-compatible plain data. Serialize then parse of a valid book MUST be lossless for document fields.

#### Scenario: Lossless round-trip

- **WHEN** a valid book is serialized and then parsed
- **THEN** the resulting book equals the original for all document fields

### Requirement: Schema version gate and migrations

The system SHALL refuse documents whose `schemaVersion` is greater than the supported version. The system SHALL provide a pure migration chain that upgrades supported older versions up to the current version before Zod validation of the current shape. Migrating schemaVersion 1 to 2 SHALL set `schemaVersion` to 2 and replace each asset value with an empty asset record (`{}`), without inventing source root, relative path, size, mtime, or hash. Migrating schemaVersion 2 to 3 SHALL set `schemaVersion` to 3 and set `title` to `""` when `title` is absent or not a string, without inventing asset metadata, orientation, capture time, color space, mime, or `meta` (including GPS). Non-asset fields other than the added `title` default SHALL be preserved. A schemaVersion 1 document SHALL migrate through 2 then 3 to the current version.

#### Scenario: Newer schema rejected

- **WHEN** input declares `schemaVersion` greater than the supported version
- **THEN** parse fails with a typed newer-schema failure (no silent field stripping)

#### Scenario: Current version migrates

- **WHEN** input declares the current `schemaVersion` and otherwise valid shape
- **THEN** migration succeeds and parse yields a book at the current version

#### Scenario: v1 empty assets migrate without invented identity

- **WHEN** a valid schemaVersion 1 document with asset values `{}` is migrated
- **THEN** the result has `schemaVersion` 3, each asset is an empty record with no source root, relative path, size, mtime, hash, or metadata fields, `title` is `""`, and other pre-existing document fields are unchanged

#### Scenario: v2 book migrates with empty title and preserved identity

- **WHEN** a valid schemaVersion 2 document with identity-filled assets and no `title` is migrated
- **THEN** the result has `schemaVersion` 3, `title` is `""`, identity fields on assets are preserved, and no metadata or GPS fields are invented

### Requirement: Asset record fields

Each asset map value SHALL be a record that MAY include `sourceRootId` (non-empty string), `relativePath` (non-empty string), `byteSize` (non-negative integer), `mtimeMs` (finite number), and `contentHash` (64-character lowercase hexadecimal SHA-256 digest). All five fields are optional. When present, values MUST satisfy those constraints. The record MUST NOT include File, Blob, or filesystem handles.

#### Scenario: Full asset record parses

- **WHEN** an asset value includes valid `sourceRootId`, `relativePath`, `byteSize`, `mtimeMs`, and a 64-character lowercase hex `contentHash`
- **THEN** parse accepts the document and retains those fields

#### Scenario: Empty asset record parses

- **WHEN** an asset value is `{}`
- **THEN** parse accepts the document

#### Scenario: Negative byte size rejected

- **WHEN** an asset value has `byteSize` less than 0
- **THEN** parse fails

#### Scenario: Empty string identity field rejected

- **WHEN** an asset value has `sourceRootId`, `relativePath`, or `contentHash` equal to `""`
- **THEN** parse fails

#### Scenario: Non-SHA-256 contentHash rejected

- **WHEN** an asset value has `contentHash` that is not a 64-character lowercase hexadecimal string
- **THEN** parse fails

### Requirement: Referential invariants at parse

After successful shape validation, the system SHALL reject documents that violate: (1) every frame `assetId` exists in `assets`; (2) every placed `assetId` appears in `gallery`; (3) every gallery id exists in `assets`; (4) gallery ids are unique.

#### Scenario: Dangling frame asset rejected

- **WHEN** a frame references an asset id absent from `assets`
- **THEN** parse fails

#### Scenario: Placed asset missing from gallery rejected

- **WHEN** a frame references an asset present in `assets` but absent from `gallery`
- **THEN** parse fails

#### Scenario: Duplicate gallery id rejected

- **WHEN** `gallery` contains the same asset id more than once
- **THEN** parse fails

### Requirement: Structural-sharing updates

The system SHALL expose pure immutable update helpers for spread and frame changes such that when a helper leaves a spread's content unchanged, that spread object identity is preserved on the returned book; when only one spread changes, other spread identities remain unchanged.

#### Scenario: Unrelated spreads keep identity

- **WHEN** an update changes frames on one spread
- **THEN** other spreads in the returned book are reference-equal to the input book's corresponding spreads

#### Scenario: No-op update keeps book identity

- **WHEN** an update produces the same spread content as before
- **THEN** the returned book is reference-equal to the input book (or at least the unchanged spreads and the book root when no fields changed)

### Requirement: Core module purity

`src/core` SHALL NOT import React, DOM APIs, or UI/platform modules (`src/photo`, `src/perf`, `src/App`). Dependency cruiser SHALL enforce a `core-is-pure` rule.

#### Scenario: Dependency gate

- **WHEN** `pnpm deps` runs on a tree where `src/core` imports React
- **THEN** the `core-is-pure` rule fails

### Requirement: Asset metadata fields

Each asset map value MAY include optional metadata fields. When present, `widthPx`/`heightPx` MUST be positive integers, `orientation` MUST be an integer 1..8, `capturedAt`/`colorSpace`/`iccProfileName`/`mime` MUST be non-empty strings, and `meta` MUST use non-empty strings for `title`/`caption`/`camera`/`lens`/`keywords` entries and finite `{ lat, lon }` for `gps`.

#### Scenario: Full metadata asset parses

- **WHEN** an asset value includes valid `widthPx`, `heightPx`, `orientation` (1..8), `capturedAt`, `colorSpace`, `iccProfileName`, `mime`, and `meta` with non-empty `title`, `caption`, `camera`, `lens`, `keywords` strings, and finite `gps` `{ lat, lon }`
- **THEN** parse accepts the document and retains those fields

#### Scenario: Invalid orientation rejected

- **WHEN** an asset value has `orientation` outside 1..8
- **THEN** parse fails

#### Scenario: Non-positive pixel size rejected

- **WHEN** an asset value has `widthPx` or `heightPx` less than 1
- **THEN** parse fails

#### Scenario: Empty capturedAt rejected

- **WHEN** an asset value has `capturedAt` equal to `""`
- **THEN** parse fails

#### Scenario: Empty meta string field rejected

- **WHEN** an asset `meta.title`, `meta.caption`, `meta.camera`, `meta.lens`, or a `meta.keywords` entry equals `""`
- **THEN** parse fails

### Requirement: GPS library storage and export strip policy

The system SHALL allow asset `meta.gps` in the library book document whenever location is present in extracted metadata (no opt-in gate). Any static export or publish (M5/M7+) MUST strip GPS from published output by default. Absence of `meta.gps` remains valid. Export implementation may land later; this is writer/exporter policy.

#### Scenario: Document without GPS remains valid

- **WHEN** an asset `meta` object omits `gps`
- **THEN** parse accepts the document

#### Scenario: GPS retained in library document without opt-in

- **WHEN** an asset includes valid `meta.gps` from metadata extraction with no consent flag
- **THEN** parse accepts the document and retains those coordinates in the library document

#### Scenario: Export and publish strip GPS by default

- **WHEN** a static export or publish pipeline produces output from a library document that contains `meta.gps`
- **THEN** the published output omits GPS coordinates by default

### Requirement: Book summary title

Library book summaries SHALL include `id` and `title`, where `title` is the book document's `title` string (empty when the document title is empty or when the stored book cannot be parsed for listing).

#### Scenario: Listed summary carries title

- **WHEN** a stored book has `title` `"Summer"` and books are listed
- **THEN** the summary for that book includes `title` `"Summer"`
