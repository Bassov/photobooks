# library-storage

Tag: prep
Milestone: M2
Title: book persistence contract

## Scope

- [x] Domain-level `LibraryStorage` interface (no paths/bytes in its API); typed results (`permission-required`, `locked-elsewhere`, `not-found`, `corrupted`, `newer-schema`, `already-exists`)
- [x] Memory adapter; one shared contract-test suite
