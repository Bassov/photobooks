## ADDED Requirements

### Requirement: Parent spreads

Schema version 10 SHALL let a book store `parents` (each with id, name, shared frames, guides, an optional partial layout grid and optional page-number items), an optional `defaultParentId` and optional `pageNumbering` (`start` ≥ 0, `skipFirst`, `format` `decimal` | `lower-roman` | `upper-roman`). A spread MAY store `parentId` (absent → the book default; `null` → None) and `parentOverrides` (hidden parent frame / guide ids, local frame / guide copies carrying the `overridesId` they replace). Migrating schemaVersion 9 to 10 SHALL only set `schemaVersion` to 10. The pure resolver SHALL return the grid book → parent → spread (None or an unknown id → the book grid), parent guides minus hidden / overridden then local copies then spread guides, and parent frames minus hidden / overridden, then local copies, then spread frames on top.

#### Scenario: v9 book loads unchanged

- **WHEN** any valid schemaVersion 9 document is migrated and parsed
- **THEN** it equals the input with `schemaVersion` 10 and no other field changed

#### Scenario: Hidden and overridden parent items never resolve

- **WHEN** a spread hides one parent frame and overrides another
- **THEN** neither parent original is resolved, the local copy is, and every spread frame paints above every parent-layer frame
