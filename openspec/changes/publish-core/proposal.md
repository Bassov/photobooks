## Proposal

Roadmap: [`docs/roadmap/P3/publish-core.md`](../../../docs/roadmap/P3/publish-core.md) (scope / Done when / Browser / Perf SoT).

### Scope out

- Any UI and the `fetch` upload loop (`publish-credentials`, `in-app-publish`).
- CSP `connect-src`; writing the remote publish manifest.

### Delta / Risk

- New capability `src/publish/` + spec `publish`; no new dependency.
- Security: R2 token stays in editor-origin IndexedDB only; leak PBT + import-boundary guard; Security Review before archive.
