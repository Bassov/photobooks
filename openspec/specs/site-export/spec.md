# site-export Specification

## Purpose

Builds the static site of a library as a pure, deterministic in-memory file tree: published books from their frozen revisions, prerendered HTML, content-addressed web derivatives, the viewer bundle and a manifest, and writes it into a chosen folder's `dist/` from a module worker. The export UI belongs to `static-export`.

## Requirements

### Requirement: Deterministic site tree

The system SHALL build the static site as an in-memory tree of files sorted by path (prerendered HTML pages, content-addressed derivative files, the viewer bundle and a `site.json` manifest) from the library meta, the published revisions and the encoded derivatives, with no clock, random or locale-dependent output; the same input in any order SHALL yield byte-identical files.

#### Scenario: Export twice

- **WHEN** the same library is exported twice, with books and derivatives in a different order
- **THEN** both trees have the same paths and byte-identical files

### Requirement: Published revisions only

The system SHALL export a book only while its library status is published, and only from its frozen revision; draft books, unpublished books and edits made after publishing SHALL NOT appear, and asset metadata (GPS, captions, file names) SHALL NOT leave the library.

#### Scenario: Edit after publish

- **WHEN** a book is published, then retitled and given a new photo in the draft
- **THEN** the tree carries the published title and none of the new photo's derivatives

### Requirement: Referenced files exist

The system SHALL reference from HTML and the manifest only derivative files present in the tree, and SHALL report each wanted `(assetHash, presetId)` derivative missing from the input instead of linking it.

#### Scenario: Missing derivative

- **WHEN** a published photo has no derivative in the input
- **THEN** no page or manifest entry links it and `missing` lists that asset for every preset

### Requirement: Write into dist

The system SHALL write the site tree under `<folder>/dist/`, replacing an existing `dist/` only when its root holds our `site.json` manifest (or it is empty); after a write the `dist/` file set SHALL equal the tree's file set with identical bytes, and a `dist/` that is not ours SHALL be left unchanged with a `not-our-export` error.

#### Scenario: Foreign dist

- **WHEN** the chosen folder has a `dist/` file, or a non-empty `dist/` directory without our manifest
- **THEN** nothing in it is written or removed and the export fails with `not-our-export`

#### Scenario: Earlier export

- **WHEN** `dist/` holds an earlier export with files the new tree lacks
- **THEN** those files are removed and every tree file is written

### Requirement: Export worker

The system SHALL run `buildSiteTree` and the writes in a module worker that posts only `{phase, done, total}` progress, at most one message per 250 ms, then `{done: {books, files, bytes}}` or `{failed: {code}}` with code `permission`, `quota`, `not-our-export` or `unknown`.
