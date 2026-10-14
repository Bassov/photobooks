# book-core Specification

## Purpose

Defines the pure book document model: schema versioning, parse/serialize boundaries, referential invariants, and structural-sharing updates used by later editor and layout features.

## Requirements

### Requirement: Book document schema v1

The system SHALL represent a photobook as a pure, serializable document with integer `schemaVersion` 1, book settings (trim size in mm, bleed, safe margin), a book-level layout grid (margins, columns, rows, gutters in mm), book-level guides, an assets map keyed by asset id, an ordered gallery of unique asset ids, and an ordered list of spreads. Each spread SHALL contain frames (rect in mm, z-order, optional asset id, optional crop) and MAY override layout grid and guides. Crop SHALL be `{ zoom ≥ 1, center: { x, y } }` in normalized source coordinates. Asset identity SHALL be the map key (values carry no duplicate id field). Assets SHALL be referenced by id only (no File, Blob, or handles). The document SHALL NOT store a separate `pages` collection.

#### Scenario: Minimal valid book parses

- **WHEN** a JSON document matching schema v1 with empty gallery and at least one spread is parsed
- **THEN** the system returns a typed book document with `schemaVersion` 1

#### Scenario: Frame crop shape

- **WHEN** a frame includes crop data
- **THEN** zoom is at least 1 and center coordinates are finite numbers in normalized source space

### Requirement: Parse and serialize round-trip

The system SHALL parse unknown input into a book document (or a typed failure) and SHALL serialize a valid book to JSON-compatible plain data. Serialize then parse of a valid book MUST be lossless for document fields.

#### Scenario: Lossless round-trip

- **WHEN** a valid book is serialized and then parsed
- **THEN** the resulting book equals the original for all document fields

### Requirement: Schema version gate and migrations

The system SHALL refuse documents whose `schemaVersion` is greater than the supported version. The system SHALL provide a pure migration chain that upgrades supported older versions up to the current version before Zod validation of the current shape. When only version 1 exists, migration for version 1 SHALL be an identity step.

#### Scenario: Newer schema rejected

- **WHEN** input declares `schemaVersion` greater than the supported version
- **THEN** parse fails with a typed newer-schema failure (no silent field stripping)

#### Scenario: Current version migrates

- **WHEN** input declares the current `schemaVersion` and otherwise valid shape
- **THEN** migration succeeds and parse yields a book at the current version

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
