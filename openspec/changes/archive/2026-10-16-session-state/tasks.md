# Tasks

## 1. Domain API and memory adapter

- [x] 1.1 Add `SessionState` types and `createMemorySessionState` under `src/project/session/` (remember/recall/clear handles; acquire/release book locks; reuse `StorageResult` codes) — verify with unit tests for empty recall `not-found`, round-trip identity, clear, lock release re-acquire, and concurrent `locked-elsewhere`
- [x] 1.2 Add shared `runSessionStateContract` harness (factory + `setPermissionRequired`) covering every typed failure this capability requires — verify memory factory passes the full suite

## 2. Browser adapter

- [x] 2.1 Implement thin IndexedDB helper + `createBrowserSessionState({ idb, locks })` wiring real ports by default — verify browser factory with fake IDB/locks passes the shared contract suite (including `permission-required` via `queryPermission({ mode: 'readwrite' })`)
- [x] 2.2 Export session public API from `src/project/index.ts` and add AGENTS.md module-map row for `session-state` — verify exports typecheck and map stays ≤150 lines

## 3. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — green with flaky retries on unrelated UI specs; session-state is prep/non-UI
- [x] pnpm stryker:diff — 98.50% (131 killed / 2 survived equivalent: empty `!stored.present` falls through to `isFileSystemHandle` → same `not-found`); excluded `idb.ts` / `locks.ts` as platform shells (see `stryker.mutate.md`)
- [x] pnpm test:coverage — session adapters covered via contract suite; remaining uncovered lines are only `idb.ts` / `createNavigatorSessionLocks` platform shells (exercised via injected ports; excluded from mutate) — no uncovered specified-behavior lines in in-scope production files
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI / no bundle entry)
- [x] UI in scope: browser smoke evidenced … — N/A (prep, no UI)
- [x] Docs/rules sync: AGENTS.md module map + nested roadmap tick; no README/future-architecture drift beyond existing SessionState notes
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — green (FSA handles / IDB / Web Locks in scope; no lockfile change)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: 00d11e1c)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: 397b58fa pass; medium coverage note addressed)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; contract suite covers spec scenarios (see Manual test scenarios)
- [x] High-risk security surface: Cursor Security Review subagent before archive (evidenced: 1b4f37cf — no medium+ findings)

## Manual test scenarios

N/A — [prep] with no UI. Spec scenarios locked by `src/project/session/*.test.ts` via `runSessionStateContract` (+ browser extras):

1. Empty recall / clear missing → `not-found` — observed via contract suite.
2. remember → recall round-trip (same handle identity) — observed via contract suite + memory identity test.
3. Exclusive lock acquire → release → re-acquire; concurrent hold → `locked-elsewhere` — observed via contract suite.
4. `permission-required` on recall when readwrite permission denied; memory gate on remember/clear/acquire — observed via contract + unit tests.
