# book-core Specification

## Purpose

Defines the pure book document model: schema versioning, parse/serialize boundaries, referential invariants, and structural-sharing updates used by later editor and layout features.

## Requirements

### Requirement: Book document schema v1

The system SHALL represent a photobook as a pure, serializable document with integer `schemaVersion` 4, an optional book `title` string (may be empty when present), book settings (trim size in mm, bleed, safe margin), a book-level layout grid (margins, columns, rows, gutters in mm), book-level guides, an assets map keyed by asset id, an ordered gallery of unique asset ids, and an ordered list of spreads. Each spread SHALL contain frames (rect in mm, z-order, optional asset id, optional crop) and MAY override layout grid and guides. Crop SHALL be `{ zoom ≥ 1, center: { x, y } }` in normalized source coordinates. A frame MAY carry `fit` (`fill` | `fit`; absent = fill/cover). Asset identity SHALL be the map key (values carry no duplicate id field). Each asset value SHALL be an asset record (see Asset record fields and Asset metadata fields). Assets SHALL be referenced by id only (no File, Blob, or handles). The document SHALL NOT store a separate `pages` collection.

#### Scenario: Minimal valid book parses

- **WHEN** a JSON document matching the current schema with empty gallery, omitted `title`, and at least one spread is parsed
- **THEN** the system returns a typed book document with `schemaVersion` 4 and no invented `title`

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

The system SHALL refuse documents whose `schemaVersion` is greater than the supported version. The system SHALL provide a pure migration chain that upgrades supported older versions up to the current version before Zod validation of the current shape. Migrating schemaVersion 1 to 2 SHALL set `schemaVersion` to 2 and replace each asset value with an empty asset record (`{}`), without inventing source root, relative path, size, mtime, or hash. Migrating schemaVersion 2 to 3 SHALL set `schemaVersion` to 3 and set `title` to `""` when `title` is absent or not a string, without inventing asset metadata, orientation, capture time, color space, mime, or `meta` (including GPS). Non-asset fields other than the added `title` default SHALL be preserved. A schemaVersion 1 document SHALL migrate through 2, 3, then 4 to the current version (3 → 4 is specified under Frame rotation, lock and photo rotation fields).

#### Scenario: Newer schema rejected

- **WHEN** input declares `schemaVersion` greater than the supported version
- **THEN** parse fails with a typed newer-schema failure (no silent field stripping)

#### Scenario: Current version migrates

- **WHEN** input declares the current `schemaVersion` and otherwise valid shape
- **THEN** migration succeeds and parse yields a book at the current version

#### Scenario: v1 empty assets migrate without invented identity

- **WHEN** a valid schemaVersion 1 document with asset values `{}` is migrated
- **THEN** the result has `schemaVersion` 4, each asset is an empty record with no source root, relative path, size, mtime, hash, or metadata fields, `title` is `""`, and other pre-existing document fields are unchanged

#### Scenario: v2 book migrates with empty title and preserved identity

- **WHEN** a valid schemaVersion 2 document with identity-filled assets and no `title` is migrated
- **THEN** the result has `schemaVersion` 4, `title` is `""`, identity fields on assets are preserved, and no metadata or GPS fields are invented

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

### Requirement: GPS storage and export policy

The system SHALL store asset `meta.gps` only when the user has opted in to keep location for that library or asset. Site export MUST omit GPS coordinates from any exported package or published payload so that location never leaves the library via site export. This requirement defines policy for writers and exporters; absence of `meta.gps` remains valid.

#### Scenario: Document without GPS remains valid

- **WHEN** an asset `meta` object omits `gps`
- **THEN** parse accepts the document

#### Scenario: Opt-in GPS retained in library document

- **WHEN** an asset includes valid `meta.gps` after user opt-in
- **THEN** parse accepts the document and retains those coordinates in the library document

### Requirement: Book summary title

Library book summaries SHALL include `id` and `title`, where `title` is the book document's `title` string (empty when the document title is empty or when the stored book cannot be parsed for listing).

#### Scenario: Listed summary carries title

- **WHEN** a stored book has `title` `"Summer"` and books are listed
- **THEN** the summary for that book includes `title` `"Summer"`

### Requirement: Duplicate spread

The system SHALL provide a `duplicateSpread` op (`BookOp` `duplicateSpread`) that inserts a copy of a spread right after the source with a fresh (or given) id, the same template and cloned frames, and re-applies templates to spreads whose page count changed. An unknown spread id MUST return the same book.

#### Scenario: Copy follows the source

- **WHEN** spread `a` of `[a, b]` is duplicated
- **THEN** the spreads are `[a, copy, b]`, `copy` has `a`'s frames, and `a` keeps its identity

### Requirement: Remove spread re-flows page roles

`removeSpread` SHALL re-apply templates to spreads whose page count changed because of the removal (e.g. the new last spread becomes single-page).

#### Scenario: Removing the last spread

- **WHEN** the last spread of a book is removed
- **THEN** the new last spread is laid out for its single-page role

### Requirement: Move spread re-lays changed page roles

`moveSpread` SHALL reapply the template of every spread whose page count changes because of the move (first and last spreads are single-page), keeping its photos.

#### Scenario: First spread moved to the middle

- **WHEN** the first spread is moved to the middle of the book
- **THEN** it becomes a two-page spread laid out with its template and keeps its photos

### Requirement: Layout grid settings

The book layout grid (margins top / bottom / inside / outside, columns, rows, column and row gutters) SHALL be editable at book level, and a spread MAY override single fields. Columns and rows MUST clamp to 1–12; margins and gutters MUST be ≥ 0. A spread override stores only the fields it changes; resetting removes it. A grid edit MUST be one history step (undoable) and MUST re-align only templated spreads that read a changed field from the grid, keeping placements.

#### Scenario: Override one field and reset

- **WHEN** a spread overrides columns to 5 and the book grid has 2
- **THEN** that spread resolves 5 columns, others 2, and reset restores the book value

### Requirement: Layout grid editing UI

The Inspector SHALL offer Spread and Book tabs, each with a "Layout grid" section (summary `columns×rows`, eight numeric fields, a header toggle that shows or hides an editor-only grid overlay, and the note "Facing pages are mirrored: inside = spine side."). The Spread tab MUST label each field BOOK or SPREAD and offer "Reset to book grid", disabled when the spread has no override. The overlay MUST NOT appear in thumbnails or output.

#### Scenario: Spread override label

- **WHEN** the user changes Columns on a spread
- **THEN** its Columns label reads SPREAD and Reset to book grid is enabled

### Requirement: Frame rotation, lock and photo rotation fields

A frame MAY carry `rotationDeg` (number, degrees about its center; absent = 0) and `locked` (boolean; absent = unlocked). A frame crop MAY carry `quarterTurns` (integer 0–3 clockwise; absent = 0) and `straightenDeg` (number in [-45, 45]; absent = 0). Migrating schemaVersion 3 to 4 SHALL set `schemaVersion` to 4 and set `rotationDeg` to 0 on frames lacking it, without setting `locked` or crop rotation.

#### Scenario: v3 book migrates

- **WHEN** a valid schemaVersion 3 document is migrated
- **THEN** the result has `schemaVersion` 4, every frame has `rotationDeg` 0 and no `locked`, and the document parses as the current shape

### Requirement: Spread master and background

A spread MAY store `masterId` (`A`, `B` or `none`; absent means Master A) and `backgroundColor` (sRGB hex; absent means the book page colour). Setting Master A or clearing the colour SHALL remove the field. Each change MUST be one history step touching only that spread. Parse MUST refuse an unknown master id.

#### Scenario: Master round-trip

- **WHEN** spread 1 is set to Master B, then None, then Master A
- **THEN** it stores `B`, then `none`, then no `masterId`, and other spreads are unchanged
