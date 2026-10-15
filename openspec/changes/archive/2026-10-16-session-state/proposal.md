# Proposal

## Problem

M2 needs durable per-browser state: File System Access directory handles and single-writer book locks. `LibraryStorage` adapters exist, but handles and real Web Locks are still deferred — later open/save and permissions UX would invent IndexedDB and lock wiring without a domain `SessionState` contract.

## Why now

Next unchecked roadmap item after `library-storage-fsa`. `open-save-project`, `permissions-locks-ux`, and `recents-home` depend on one `SessionState` interface with memory + browser adapters and a shared contract suite.

## Scope in

- Domain `SessionState` for library directory handles (IndexedDB) and Web Locks per book
- Memory adapter and browser adapter; shared contract-test suite both must pass
- Security surface: File System Access handles persisted in IndexedDB; Web Locks coordination

## Scope out

- Open/save UI, permission re-grant chrome, home/recents UI
- Wiring locks into `LibraryStorage` call sites / editor shell (later features)
- Asset identity, OPFS derived cache, schema bumps
- Recents list and UI prefs APIs entirely (`recents-home` and later prefs work)
- Any prefs keys beyond handle + lock behavior

## Capabilities

### New Capabilities

- `session-state`: per-browser disposable session — library directory handles and per-book exclusive locks via typed results

### Modified Capabilities

- (none)

## Success criteria

- `SessionState` domain API stores/restores library directory handles without exposing IndexedDB keys on the API
- Per-book exclusive lock acquire/release; a second holder is rejected with a typed lock failure
- Memory and browser adapters pass the shared contract suite
- No UI; `src/project` stays free of React

## Risks

- **Security:** IndexedDB may hold FSA directory handles — keep handles adapter-internal on the domain API; do not serialize handles into book documents or worker messages; surface missing/revoked permission as a typed permission failure when detectable
- Fake IndexedDB / Web Locks in Node tests may diverge from Chromium — keep fakes at the storage/lock boundary
- One-subsystem budget: `SessionState` (+ adapters) only; no open/save chrome
