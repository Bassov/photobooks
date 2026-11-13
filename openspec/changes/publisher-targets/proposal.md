## Proposal

Roadmap: [`docs/roadmap/P5/publisher-targets.md`](../../../docs/roadmap/P5/publisher-targets.md) (scope / Done when).

### Scope out

- New targets, hosting UI or Settings changes (P5 `connect-own-hosting`).
- Any change to R2 request, retry, manifest or `cacheControlOf` behaviour.

### Delta / Risk

- Refactor only: `publisher.ts` holds the `Publisher` interface, its capabilities and `createPublisher`. `r2Publisher.ts` wraps `publishSite` and `checkConnection` as the one target. The worker and the hosting check call through the interface.
- Security: the credentials stay inside the worker and the target. `redact` and the import boundary don't change.
