## Proposal

Roadmap: [`docs/roadmap/P3/in-app-publish-core.md`](../../../docs/roadmap/P3/in-app-publish-core.md) (scope / Done when).

### Scope out

- Any UI (Publish pill, dialog, store, `beforeunload`): item `in-app-publish`.
- Cancel / abort of a running publish (P3: Hide keeps the run going).
- Deriving encoded images: the worker gets them as input, as `site-export.worker.ts` does.

### Delta / Risk

- Security: the worker reads credentials from IndexedDB itself; no credential crosses `postMessage`; failure messages are redacted.
