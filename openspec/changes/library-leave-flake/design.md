## Decisions

1. **Binds wait for restore.** The mount-time `tryRestore` can still await the handle recall while a library is bound; when it lands, `clearStaleRestoreState` clears that library and sets `welcome`. `createLibraryActivation` keeps `restoreSettled` (a `Promise.allSettled` chain of every `tryRestore` call) and `bindLibrary` awaits it first, so a restore that started earlier always lands before the bind.
2. **Leave keeps its busy guard**: after decision 1 it cannot overlap the restore in the seam flow, and the UI Library button is disabled while busy (`isChromeBusy`).

## Touch-set & Test Plan

| File                                      | Why                                    |
| ----------------------------------------- | -------------------------------------- |
| `src/editor/session/libraryActivation.ts` | `restoreSettled`; `bindLibrary` awaits |
| `src/editor/projectSession.test.ts`       | race repro                             |
| `docs/roadmap/P4/library-leave-flake.md`  | item scope from the brief              |

- Reuse: gated-recall setup of `restorePending blocks createLibrary`.
- Tests: unit repro (gated recall; attach → create → leave) fails on main with `welcome`; e2e repeat 30×.
