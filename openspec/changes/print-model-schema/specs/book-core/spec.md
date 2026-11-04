## ADDED Requirements

### Requirement: Print profile reference

Schema version 11 SHALL let a book store `printProfile` (`id` non-empty, `overrides` with optional `trimMinMm`, `trimMaxMm`, `bleedMinMm`, `bleedMaxMm`) and a cover MAY store `print.spineWidthSource` (`profile` | `manual`); absent → the built-in `generic` profile with no overrides and `profile`. Migrating schemaVersion 10 to 11 SHALL add `printProfile` `{ id: "generic", overrides: {} }` and `cover.print` `{ spineWidthSource: "profile" }` and change no other field.

#### Scenario: v10 document gains the default profile

- **WHEN** any valid schemaVersion 10 document is migrated and parsed
- **THEN** it equals the input with `schemaVersion` 11, the default `printProfile` and `cover.print`, and no other field changed

### Requirement: Print profile validates trim and bleed

Trim and bleed SHALL stay user values. A pure validator SHALL report each trim edge or bleed outside the effective profile (built-in values, then overrides) and an unknown profile id, and SHALL never change the book.

#### Scenario: Bleed above the profile

- **WHEN** a book's bleed is above the effective profile's `bleedMaxMm`
- **THEN** the validator returns a bleed issue with the value and the allowed range, and the book is unchanged
