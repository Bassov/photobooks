# recents-idb-dedup

Tag: feature
Milestone: M3
Title: session IDB typed faults, recents isSameEntry dedup, eviction cleanup
Status: done

## Scope

- [x] IndexedDB blocked and failure paths return typed results without throw (unit tests on the `session-idb-locks-mutation` fakes)
- [x] IDB-blocked e2e (home shows storage error + retry; no uncaught throw)
- [ ] Recents dedup across separate handle objects (`isSameEntry`); when max-10 eviction drops a recent, delete its handle key from IDB — not applicable: the multi-recents list was removed (single library; `rememberLibraryHandle` replaces and deletes other handle keys, so one handle and no eviction)
- [ ] Confirm/keep recents read-modify-write in one IDB transaction (or `navigator.locks`); sync session-state spec deferred lines — not applicable: no recents list remains; the remaining handle replacement is already one `runReadwrite` transaction; the spec has no deferred lines

## Done when

Browser session adapter never throws on blocked/failed IDB; duplicate folder handles collapse to one recent; eviction cleans handle keys; e2e covers IDB-blocked home.

## Browser check

Block site storage (or stub IDB), open home — readable error + retry, focus stays usable.

## Perf

No new interaction; existing gates stay green.

## Reason

Owner 2026-10-27: blocked/failed IndexedDB and duplicate folder handles are edge cases for personal use; product first (editor, then the personal site).

## Done note

typed IDB faults + blocked-IDB retry shipped; recents dedup/eviction obsolete (single library)
