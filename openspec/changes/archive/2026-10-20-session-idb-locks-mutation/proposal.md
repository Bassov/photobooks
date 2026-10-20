## Proposal

Roadmap: [`docs/roadmap/M2.1/session-idb-locks-mutation.md`](../../docs/roadmap/M2.1/session-idb-locks-mutation.md) (scope / Done when SoT). Prep fast-track; `skip_specs: true` (test fakes + mutation reinclude; session-state domain contracts unchanged).

### Scope out

- Browser / e2e coverage of IndexedDB or Web Locks
- Replacing injected memory fakes in unrelated suites
- Expanding mutation scope beyond `idb.ts` / `locks.ts`

### Delta / Risk

- Security: new exact-pinned `fake-indexeddb` (dev-only); `audit:ci` + Security Review before archive.
