## Implementation

- [x] 1. Remove `dark` from `ClosedBook` (`gl/closed.ts`) and its caller `book3dGl.ts`; light constants inlined (`gl/closed.test.ts` green, light snapshots unchanged).
- [x] 2. Remove `dark` from `OpenBook` (`gl/open.ts`) and its caller `roomGl.ts` (`gl/open.test.ts`, `roomGl.test.ts` green).
- [x] 3. Delete dark-only scenarios and their snapshots; keep contact-shadow and floor-off coverage on the light path (`gl/closed.test.ts`).

## Manual test scenarios

N/A: no visible change (light output byte-identical, locked by unit snapshots).
