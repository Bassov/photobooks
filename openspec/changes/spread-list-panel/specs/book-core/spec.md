## ADDED Requirements

### Requirement: Duplicate spread

The system SHALL provide a `duplicateSpread` op (`BookOp` `duplicateSpread`) that inserts a copy of a spread right after the source with a fresh (or given) id, the same template and cloned frames, and re-applies templates to spreads whose page count changed. An unknown spread id MUST return the same book.

#### Scenario: Copy follows the source

- **WHEN** spread `a` of `[a, b]` is duplicated
- **THEN** the spreads are `[a, copy, b]`, `copy` has `a`'s frames, and `a` keeps its identity

### Requirement: Remove spread re-flows page roles

`removeSpread` SHALL re-apply templates to spreads whose page count changed because of the removal (e.g. the new last spread becomes single-page).

#### Scenario: Removing the last spread

- **WHEN** the last spread of a book is removed
- **THEN** the new last spread is laid out for its single-page role
