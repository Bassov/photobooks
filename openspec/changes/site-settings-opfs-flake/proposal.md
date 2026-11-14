## Proposal

Roadmap: `docs/roadmap/P3/site-settings-opfs-flake.md` (scope / Done when SoT).

### Scope out

- Derived-cache reads (`src/assets/derivedCache/opfs.ts`): content-addressed, written once per key.
- Export `dist/` readers: nothing rewrites `dist/` during a read.
- A global writer queue: does not cover a second tab.

### Delta / Risk

- Every product `library.json` / `book.json` / `published.json` read shares one adapter; one fix covers all.
- Security: read-only retry inside the existing handle adapter; no new permissions or handles; other errors propagate.
