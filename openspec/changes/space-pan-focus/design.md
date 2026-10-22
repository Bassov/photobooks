## Decisions

1. Root cause: `onKeyDown` returns early when Space targets `HTMLButtonElement` / `HTMLAnchorElement` / non-text inputs, so `spaceRef` never arms after chrome focus. Text-field guard (`isTextField`) stays.
2. Fix: for Space, drop the interactive-element early return; keep `isTextField` only. Still `preventDefault` + set `spaceRef` so Space+drag pans while pointer events hit the pasteboard scrollport (no hover-tracking needed).
3. Spec: tighten spread-view Space-pan scenario to require pan with chrome focus when not in a text field.

## Touch-set & Test Plan

| File                                 | Why                             |
| ------------------------------------ | ------------------------------- |
| `src/editor/usePasteboardCamera.ts`  | Space-pan arming                |
| `src/editor/cameraGesture.test.tsx`  | PB-04 regression                |
| `openspec/specs/spread-view/spec.md` | Space-pan chrome-focus contract |

- Reuse: `isTextField`, existing camera gesture tests, CameraBar buttons as chrome focus
- Tests (unit / PBT / e2e): unit — focus Fit width / 100%, Space+drag on `pasteboard-scroll`, assert scroll changes; text input still non-arming. e2e N/A.
