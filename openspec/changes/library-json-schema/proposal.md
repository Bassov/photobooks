## Proposal

Roadmap: `docs/roadmap/P2/library-json-schema.md`.

### Scope out

- No UI; no new `library.json` fields (v1 holds only `schemaVersion`).
- No change to book documents.

### Delta / Risk

- `src/project/libraryDocument.ts`: pure `migrateLibrary` / `parseLibrary` / `serializeLibrary`; v0 (no `schemaVersion`) → v1.
- Security: a newer `library.json` fails reads and writes with `newer-schema` and is never overwritten.
