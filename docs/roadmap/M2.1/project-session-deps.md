# project-session-deps

Tag: prep
Milestone: M2.1
Title: inject the session's platform dependencies (issue #72 L)
Status: done

## Scope

- [x] `projectSession.ts` takes `{ storage, sessionState, picker, permissions, clock / timers }` with browser defaults wired at the composition root. No logic moves
- [x] Unit tests cover the default FSA branches (picker cancel, permission prompt / denied, re-grant) with `fsa-permission-fakes`, `memorySessionState` and fake timers
- [x] Until `project-session-mutation`, `projectSession.ts` stays a `temporary` entry, so these items change it without mutating it. The extracted modules below are new files and are mutated at 85 from their first PR
- **Done when:** the permission, picker and lock paths of `projectSession.ts` run in Vitest with no browser, and its patch coverage is at least 85%.

## Done note

DI platform deps + browserProjectSessionPlatform; projectSession stays temporary; Codecov patch on PR head
