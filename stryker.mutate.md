# Mutation excludes

Each `!` pattern in `stryker.config.json` `mutate` has one reason here. JSON cannot hold comments.

- `!src/**/*.{test,spec}.{ts,tsx}` — tests are not production code
- `!src/**/*.{bench,benchmark}.{ts,tsx}` — benches are not production code
- `!src/**/*.d.ts` — declarations have no runtime behavior
- `!src/**/*.test-helpers.ts` — test helpers are not production code
- `!src/core/testing/**` — fixtures for tests
- `!src/core/index.ts` — re-exports only
- `!src/project/index.ts` — re-exports only
- `!src/assets/index.ts` — re-exports only
- `!src/main.tsx` — Vite entry
- `!src/photo/photo.worker.ts` — onmessage wrapper; logic lives in processPhoto.ts
- `!src/assets/hash.worker.ts` — onmessage wrapper; logic lives in hashDigest.ts
- `!src/project/fsa/bookLoad.worker.ts` — onmessage wrapper; logic lives in bookLoad.ts
- `!src/project/session/idb.ts` — IndexedDB open/get/set/del shell; SessionIdb port covered via injected fakes in browserSessionState tests
- `!src/project/session/locks.ts` — navigator.locks thin adapter; lock name + ifAvailable covered via injected SessionLocks in browserSessionState tests
- `!src/editor/EditorShell.tsx` — thin React chrome wiring for library open/save; behavior locked by `projectSession` unit tests and e2e `open-save` / save-during-drag scenarios
