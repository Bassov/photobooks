## ADDED Requirements

### Requirement: Print PDF marks and progress

The PDF painter SHALL take a required `marks` choice that overrides the profile's crop marks on every page, blank padding pages included: on → bleed `printBleedMm(book bleed, profile)` and crop marks; off → bleed 0, no crop marks, MediaBox = TrimBox = trim. The PDF worker SHALL post `{ progress: { painted, sheets } }` after each page, `painted` 1..`sheets` in order, without waiting on the main thread, then `done`.

#### Scenario: Marks off

- **WHEN** a book below the profile minimum is painted with marks off and a profile asking for crop marks
- **THEN** every page, padding included, has MediaBox = TrimBox = trim and no crop-mark paths
