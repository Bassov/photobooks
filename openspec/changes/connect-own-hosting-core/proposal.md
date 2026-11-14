## Proposal

Roadmap: `docs/roadmap/P5/connect-own-hosting-core.md` (scope / Done when SoT; Designer Spec `connect-own-hosting` § Core, C2, C7–C10).

### Scope out

- Relay (`src/worker/**`, `wrangler.jsonc`), kit, prod setup UI (`src/editor/**`): sibling items.
- Migration of stored records.

### Delta / Risk

- Security: the setup token stays in memory only, never persisted or logged; Security Review before archive.
