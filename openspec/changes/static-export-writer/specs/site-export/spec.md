## ADDED Requirements

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
