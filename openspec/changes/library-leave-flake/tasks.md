## Implementation

- [x] 1. Unit repro: library bound + book created + leave while `tryRestore` awaits the recall ends on `library` (`src/editor/projectSession.test.ts` › `a library bound during restore survives the restore and leave shows the library`; fails on main with `welcome`)
- [x] 2. `bindLibrary` waits for the in-flight restore (`src/editor/session/libraryActivation.ts` `restoreSettled`)

## Manual test scenarios

N/A — no visible change; the race is only reachable through the test seam while the restore is pending (UI actions are disabled then). Covered by unit + e2e repeat.
