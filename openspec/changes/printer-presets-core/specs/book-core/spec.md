## MODIFIED Requirements

### Requirement: Print profile reference

Schema version 11 SHALL let a book store `printProfile` (`id` non-empty, `overrides` with optional `trimMinMm`, `trimMaxMm`, `bleedMinMm`, `bleedMaxMm`, optional `snapshot` = a full printer profile) and a cover MAY store `print.spineWidthSource` (`profile` | `manual`); absent → the built-in `generic` profile with no overrides and `profile`. Migrating schemaVersion 10 to 11 SHALL add `printProfile` `{ id: "generic", overrides: {} }` and `cover.print` `{ spineWidthSource: "profile" }` and change no other field. The book's profile SHALL resolve built-in id → library custom id → `snapshot` → `generic` (with an `unknown-profile` issue), then apply the overrides. Built-ins SHALL be `generic` then shop profiles A→Z, each with a vendor `source` URL and an ISO `checked` date, every number from the vendor's own page. Op `setPrintProfile {id}` SHALL, as one undo step, set `{id, overrides: {}}` (plus `snapshot` for a custom profile), clamp the bleed to the profile range and set the safe margin to the profile's, keeping trim and page count; an unknown id SHALL return the same book. Book settings Pages SHALL clamp to `[20, min(120, profile max)]` in the profile's (even) step from 20.

#### Scenario: v10 document gains the default profile

- **WHEN** any valid schemaVersion 10 document is migrated and parsed
- **THEN** it equals the input with `schemaVersion` 11, the default `printProfile` and `cover.print`, and no other field changed

#### Scenario: Picking a custom profile

- **WHEN** a book with bleed 3 mm picks a custom profile with bleed 3.175 mm, safe margin 12.7 mm and pages 24–80 in steps of 4
- **THEN** the book stores its id, no overrides and a snapshot, bleed 3.175 and safe 12.7, trim and spreads unchanged, and Pages clamps 90 to 80 and rounds 27 to 28

### Requirement: Print profile validates trim and bleed

Trim and bleed SHALL stay user values. A pure validator SHALL report each trim edge or bleed outside the effective profile (built-in values, then overrides), and for an unknown profile id an `unknown-profile` issue plus the checks against `generic`; it SHALL never change the book. Print issues SHALL add fewer pages than the profile minimum and more than its maximum, with the Book settings texts "{name} takes pages from {min} cm." / "… up to {max} cm." + " This page is {v} cm {wide|high}.", "{name} prints at least {min} pages; this book’s {n} print as {min}.", "{name} prints up to {max} pages. This book has {n}." and "This book’s printer isn’t in this library. Using Generic.".

#### Scenario: Bleed above the profile

- **WHEN** a book's bleed is above the effective profile's `bleedMaxMm`
- **THEN** the validator returns a bleed issue with the value and the allowed range, and the book is unchanged

#### Scenario: Fewer pages than the profile

- **WHEN** a 20-page book uses a profile whose page count starts at 24
- **THEN** print issues include a below-minimum issue reading "… prints at least 24 pages; this book’s 20 print as 24."
