## Decisions

1. Root cause after #187: capture-phase Space `preventDefault`/`stopPropagation` while the pointer is over the pasteboard blocks react-aria filmstrip row activation. False-positive pasteboard hover can also steal Space when the pointer is over the filmstrip.
2. Keep hover-gated pan arming and capture-phase steal when the pointer is over the pasteboard (PB-04 Space+drag with filmstrip focus).
3. When Space is stolen for pan arming, record the focused activatable target. On Space keyup, if no pasteboard pan drag started, synthesize activation via `click()`. Starting a Space-pan `pointerdown` clears pending activation. This keyup path also restores activation after false-positive pasteboard steal over the filmstrip.
4. Text inputs stay exempt (unchanged). Spec: Space activates focused chrome unless a pasteboard Space-drag begins.

## Touch-set & Test Plan

| File                                 | Why                                                |
| ------------------------------------ | -------------------------------------------------- |
| `src/editor/usePasteboardCamera.ts`  | pending Space activation vs pan drag               |
| `src/editor/cameraGesture.test.tsx`  | unit: Space alone activates; Space+drag still pans |
| `e2e/spread-view.spec.ts`            | PB-04b: tile Space with pointer over pasteboard    |
| `openspec/specs/spread-view/spec.md` | activation-unless-drag contract                    |

- Reuse: hover arming, `isTextField`, existing PB-04 e2e helpers
- Tests: unit — filmstrip-like focus + pointerenter + Space keyup activates; Space+drag does not. e2e — import, focus tile, pointer over pasteboard, Space toggles; keep PB-04 pan
- UI: no new tokens/primitives; skill `ui-review` before push (behavior-only)
