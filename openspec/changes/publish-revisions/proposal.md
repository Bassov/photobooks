## Proposal

Roadmap: `docs/roadmap/P3/publish-revisions.md` (scope / Done when SoT).

### Scope out

- No UI, no e2e, no new dependencies; no book `schemaVersion` bump.
- No adapter I/O for `published.json` yet (pure document only); `in-app-publish` wires it.

### Delta / Risk

- `library.json` v2: `books: { <id>: { status } }`; v0/v1 upgrade to an empty map. Invalid v2 fails `corrupted` and is never overwritten; create-library keeps an existing map.
- Security: `published.json` parses through `parseBook` (Zod); no new surface.
