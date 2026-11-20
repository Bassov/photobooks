## Decisions

1. Crop math becomes pure helpers in `model.ts` built on one form: the photo's page rect (`photoRect`). Frame crop, corner scale and pan move that rect, then `cropFor` turns it back into `zoom/ox/oy/fit`.
2. One `FrameChrome` in `canvas.tsx` replaces `Handles` for a single filled photo frame. Its DOM order is the Spec hit order. The crop ghost moves from `FrameEl` into it.
3. Photo-layer visibility is local chrome state. Pinned stays the store's `cropId`.
4. Pinned arrows pan in screen px from the chrome. `viewport.tsx` drops its 5 % crop nudge so the two do not double.
5. Tokens: existing kit `--crop`, `--select`, `--paper`, `bg-field`, and focus `#3A3839` (Spec). Fade via tw-animate. The kit has no camera scale, so plain px are screen px. Skill `ui-review` before push.

## Touch-set & Test Plan

| Path                             | Why                              |
| -------------------------------- | -------------------------------- |
| `uikit/src/sandbox/model.ts`     | crop math                        |
| `uikit/src/sandbox/canvas.tsx`   | chrome + gestures                |
| `uikit/src/sandbox/viewport.tsx` | nudge handover                   |
| `uikit/scripts/demo-capture.mjs` | demo steps                       |
| `e2e/kit-direct-crop.spec.ts`    | new e2e                          |
| `e2e/kit-book-settings.spec.ts`  | frame centre is the grabber      |
| `e2e/kit-frame-style.spec.ts`    | frame centre is the grabber      |
| `e2e/kit-layout-picker.spec.ts`  | frame centre is the grabber      |
| `e2e/kit-editor-canvas.spec.ts`  | frame drag after the layer hides |

- Tests: e2e `kit-direct-crop.spec.ts`, one test per Done-when line (paint via `elementsFromPoint`). The testids of the existing kit handles are kept.
