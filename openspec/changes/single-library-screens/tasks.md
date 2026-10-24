## Implementation

- [x] 1. Rewrite session-state to a single library handle (+ label, active book id, locks); migrate old `__recents` → most-recent handle; drop remove-recent / multi-recent APIs; update contract suite.
- [x] 2. Add unsupported-browser gate (no FSA picker / insecure context / mobile UA) as a blocking screen; keep FSA stubs for tests.
- [x] 3. Welcome + permission re-grant surfaces: Choose library folder picker (`id: 'photobooks-library'`, readwrite, startIn documents); restore queryPermission; prompt → Allow access button → requestPermission before new picker.
- [x] 4. Empty library (Create book) and library-with-books (list, New book, Change library + folder name, Settings stub dialog); change library replaces single handle with isSameEntry dedupe.
- [x] 5. Retire multi-library home chrome; editor back control goes to library surface; wire App surface machine.
- [x] 6. Update OpenSpec deltas for `session-state` and `editor-shell` (remove obsolete recents/home requirements; no new overlapping capability).
- [x] 7. Update unit/RTL tests for session + new screens; remove/rewrite recents-home coverage.
- [x] 8. Update e2e (welcome / library empty+list / change library / settings / back-to-library / unsupported); keep Chromium FSA doubles — no forced file-input fallbacks.

## Manual test scenarios

1. Unsupported: disable directory picker (or mobile UA) → only Chromium message, no other UI. — OK (e2e `unsupported browser blocks…`)
2. Welcome: no handle → Choose library folder → granted → library (empty or list). — OK (e2e welcome + memory library)
3. Reload with prompt permission → Allow access to \<name\> restores library without new pick when granted. — OK (unit WelcomeScreen re-grant + permissions-locks)
4. Empty library → Create book → editor; back → empty or list. — OK (LibraryScreen unit + e2e)
5. Library with books → open book; New book; Change library shows folder name; Settings stub opens/closes. — OK (e2e change library + settings)
6. Editor back → library (not welcome) while handle still remembered. — OK (e2e memory library back)

## UI review (skill ui-review)

- Design system: placeholder screens use `Button` / `EmptyState` / `Dialog` / `Status` + tokens; no new palette. — OK
- A11y: library `h1`, settings dialog title, focusable list/rename controls; primary actions keyboard-reachable. — OK
- States: busy disables choose/create/change; loading + permission re-grant empty states; settings open/close. — OK
- Layout smoke (Playwright): welcome/library/unsupported fit viewport; library-scroll named scrollport with many books. — OK (`e2e/library-screens.spec.ts`)
