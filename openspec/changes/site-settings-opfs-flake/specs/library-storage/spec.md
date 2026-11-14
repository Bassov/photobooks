## ADDED Requirements

### Requirement: Reads survive an overlapping write

A library folder file read (`library.json`, `book.json`, `published.json`) that overlaps a write to the same file (autosave, a settings commit, a second tab) SHALL return the whole old or whole new content, not fail with `NotReadableError`; it fails only when the file keeps changing across 4 reads.

#### Scenario: Write commits between snapshot and read

- **WHEN** a read takes its file snapshot and a write to that file commits before the read finishes
- **THEN** the read returns the newly written text
