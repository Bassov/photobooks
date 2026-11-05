## Implementation

- [x] 1. `parentHitAt`: `copy` hit kind, order copies → parent guide → parent frame (`src/editor/parentHit.ts`); unit + PBT cases in `src/editor/parentHit.test.ts`.
- [x] 2. `overrideSession`: a copy hit selects / moves the copy with no op (`src/editor/frameGesture.ts`; `src/editor/frameGesture.override.test.ts` "reselects and moves it with no new override").
- [x] 3. e2e `e2e/parent-overrides-reselect.spec.ts`: click away, Ctrl+Shift press on the covered copy selects it, drag moves it, the reselect adds no undo step.
- [x] 4. Pasteboard spec delta: hit order + reselect scenario.

## Manual test scenarios

1. Painter fixture with Master A: override the logo under an own frame, click the pasteboard, Ctrl+Shift press the logo area → the copy is selected (ring + 8 handles); drag → it moves; Undo → back to the earlier spot.
