# session-idb-locks-mutation

Tag: prep
Milestone: M2.1
Title: IndexedDB and Web Locks fakes; mutate the adapters (issue #72 L, B)

## Scope

- [ ] `fake-indexeddb` (exact-pinned dev dependency through `dependency-policy`). Run the `sessionState.contract` suite against the real `idb.ts` adapter: `present: false`, store creation on upgrade, `close()` in `finally`
- [ ] In-memory `LockManager` fake for `navigator.locks` (`ifAvailable` returns `null` when the lock is held). Test `locks.ts` and the `bookLockName()` cross-tab contract
- [ ] Remove the `idb.ts` and `locks.ts` `temporary` entries
- includes: IDB v1→v2 migration test on `fake-indexeddb` (from main's `recents-home-quality`)
- **Done when:** `idb.ts` and `locks.ts` run in Vitest with no browser, and both are mutated on both runs at 85+ with no NoCoverage.
