# Tasks

## Implementation

- [x] 1. Exact-pin `fake-indexeddb` 6.2.6 (devDependency); `pnpm audit:ci` clean
- [x] 2. `sessionState.contract` + adapter tests against real `createSessionIdb` via fake-indexeddb (`present: false`, store on upgrade, `close()` in finally, v1→v2 migration)
- [x] 3. In-memory `LockManager` fake for `navigator.locks`; unit tests for `createNavigatorSessionLocks` + `bookLockName` cross-tab contract
- [x] 4. Drop `idb.ts` / `locks.ts` from `mutation.temporaryExcludes` and `stryker.config.mjs` bangs (+ `stryker.mutate.md`)
- [x] 5. Targeted `stryker run --mutate idb.ts,locks.ts` → 100% both files, 0 NoCoverage; Manual N/A

## Manual test scenarios

N/A — prep; Vitest + fake-indexeddb / LockManager fake only; no new UI surface.
