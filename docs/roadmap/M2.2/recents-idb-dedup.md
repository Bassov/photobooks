# recents-idb-dedup

Tag: feature
Milestone: M2.2
Title: session IDB typed faults, recents isSameEntry dedup, eviction cleanup

## Scope

- [ ] IndexedDB blocked and failure paths return typed results without throw (unit tests on the `session-idb-locks-mutation` fakes)
- [ ] IDB-blocked e2e (home shows storage error + retry; no uncaught throw)
- [ ] Recents dedup across separate handle objects (`isSameEntry`); when max-10 eviction drops a recent, delete its handle key from IDB
- [ ] Confirm/keep recents read-modify-write in one IDB transaction (or `navigator.locks`); sync session-state spec deferred lines

## Done when

Browser session adapter never throws on blocked/failed IDB; duplicate folder handles collapse to one recent; eviction cleans handle keys; e2e covers IDB-blocked home.

## Browser check

Block site storage (or stub IDB), open home — readable error + retry, focus stays usable.

## Perf

No new interaction; existing gates stay green.
