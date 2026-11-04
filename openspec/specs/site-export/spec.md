# site-export Specification

## Purpose

Builds the static site of a library as a pure, deterministic in-memory file tree: published books from their frozen revisions, prerendered HTML, content-addressed web derivatives, the viewer bundle and a manifest. Writing the tree to disk belongs to `static-export`.

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
