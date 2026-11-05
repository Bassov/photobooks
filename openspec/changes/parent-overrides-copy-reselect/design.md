## Decisions

1. `parentHitAt` returns a third kind `{ kind: 'copy', frameId }`. Order (Designer: copies first): the topmost `layer: 'override'` frame of `resolveParentFrames` under the press (same rotation-aware `frameContains`), then the parent guide band, then the topmost parent frame.
2. `overrideSession` (`frameGesture.ts:449`): a `copy` hit dispatches nothing and continues as `copyMoveSession` (select on release, move past 3 px as one step); a `frame` hit keeps `overrideParentFrame` first; a guide hit stays `null`.
3. Plain Select press status (`frameGesture.ts:704`): same order; a copy is not an inherited item, so a `copy` hit announces nothing.
4. Callers: `parentHitAt` is called only by `parentHitOf` in `frameGesture.ts`, used at the two sites above (both fixed). No caller in the inspector, context menu or e2e.

## Touch-set & Test Plan

| Path                                       | Why                                    |
| ------------------------------------------ | -------------------------------------- |
| `src/editor/parentHit.ts`                  | copy kind, hit order                   |
| `src/editor/parentHit.test.ts`             | covered / rotated / overlapping copies |
| `src/editor/frameGesture.ts`               | copy hit → reselect + move, no op      |
| `src/editor/frameGesture.override.test.ts` | reselect: no op, move one step         |
| `e2e/parent-overrides-reselect.spec.ts`    | reselect, move, undo label             |
| `openspec/specs/pasteboard/spec.md`        | hit order in the canvas requirement    |

- Unit: copy under an own frame → copy; rotated copy (PBT); overlapping copies → higher `z`; no copy → parent frame.
- e2e: painter fixture, Master A; scenario in the spec delta.
