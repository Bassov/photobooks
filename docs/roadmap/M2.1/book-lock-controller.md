# book-lock-controller

Tag: prep
Milestone: M2.1
Title: extract locks and re-grant from `projectSession.ts`

## Scope

- [ ] `src/editor/session/bookLockController.ts`: lock acquire / release, the "open in another tab" state, and the permission re-grant flow
- [ ] Focused tests, including a second tab taking the lock and release on close
- **Done when:** the new module is mutated at 85+ with no NoCoverage, and `e2e/permissions-locks.spec.ts` passes unchanged.
