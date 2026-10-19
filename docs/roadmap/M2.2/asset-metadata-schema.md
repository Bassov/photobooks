# asset-metadata-schema

Tag: prep
Milestone: M2.2
Title: photo metadata in the document
Status: done

## Scope

- [x] Schema version bump with migration: asset oriented pixel size, EXIF orientation, `capturedAt?`, color space and ICC name, mime, optional `meta` (title, caption, keywords, camera, lens, GPS); book `title` (also on `BookSummary`)
- [x] Decision recorded in the `book-core` spec: GPS is stored only when the user opts in and never leaves the library in site export

## Done note

schema v3 + asset metadata + optional book title; GPS opt-in/no-export in book-core; BookSummary.title
