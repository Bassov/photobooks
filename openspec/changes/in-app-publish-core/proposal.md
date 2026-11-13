## Proposal

Roadmap: [`docs/roadmap/P3/in-app-publish-core.md`](../../../docs/roadmap/P3/in-app-publish-core.md) (scope / Done when); Designer Spec `shared/design/in-app-publish/spec.md` §3, P4–P9.

### Scope out

- Any UI (Publish pill, dialog, store, `beforeunload`): item `in-app-publish`.
- Cancel / abort of a running publish (P3: Hide keeps the run going).
- Deriving encoded images: the worker gets them as input, as `site-export.worker.ts` does.

### Delta / Risk

- Security: the worker reads the R2 credentials from IndexedDB itself; requests and results crossing `postMessage` carry no credential, and failure messages go through `redact`.
- `r2Request` gains `GET` and a signed `cache-control` header.
