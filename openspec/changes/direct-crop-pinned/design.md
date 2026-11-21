## Decisions

1. `snapRotationDeg(deg, shift)` (`frameHandleMath.ts`): (−180, 180]; Shift → 15° steps; else a quarter turn within ±2°. `rotatedDeg` uses it.
2. Knob in `SelectionHandles` only beside `PhotoChrome` (hides with frame handles in a photo gesture). The chip is a React span; `rotateMove` writes its text and `data-rotating` (DOM, like the transform preview), cleared on restore.
3. Pinned = today's crop mode. `SpreadView` mounts `PhotoChrome` when selected or crop-active; `pinned` keeps it shown and makes the photo handles focusable buttons. The overlay tag hides while the photo tag shows.
4. `photoGesture` also takes presses on the crop target; its capture `stopPropagation` keeps `cropGesture`'s pan off them.
5. Pure `pinnedCropKey(event)` (`cropKeys.ts`): exit / tab / nudge. Nudge is screen px, one `setCrop` per press. Wheel zoom and its one-commit-per-burst (`WHEEL_SETTLE_MS`) already ship.
6. Small frames: drop n/s mids when width < 40 px, w/e when height < 40, the grabber when a side < 64.
7. Layer timing (120 ms `--duration-fast` ease-out, 400 ms / 12 px hide, 0 ms under reduced motion in `styles/tokens.css`) ships from #658; e2e locks it.

Tokens: `--crop`, `--field`, `--select`, `--duration-fast`, focus ink `#3A3839` (`docs/design.md`). Skill `ui-review` before push.

## Touch-set & Test Plan

| File                                    |
| --------------------------------------- |
| `src/editor/frameHandleMath.ts`         |
| `src/editor/frameHandleMath.test.ts`    |
| `src/editor/frameHandleGesture.ts`      |
| `src/editor/frameHandleGesture.test.ts` |
| `src/editor/cropKeys.ts`                |
| `src/editor/cropKeys.test.ts`           |
| `src/editor/cropGesture.ts`             |
| `src/editor/cropGesture.test.ts`        |
| `src/editor/photoGesture.ts`            |
| `src/editor/photoGesture.test.ts`       |
| `src/render/PhotoChrome.tsx`            |
| `src/render/SpreadView.tsx`             |
| `src/render/SpreadView.css`             |
| `src/render/SpreadView.chrome.test.tsx` |
| `e2e/direct-crop-pinned.spec.ts`        |
| `e2e/design-r2-inspector.spec.ts`       |
| `e2e/crop-in-frame.spec.ts`             |

- Unit: snap table, key mapping, chrome. e2e: happy (chip), interact (pinned keys / wheel), edge (50 × 30 frame), empty frame without knob; computed style + `elementFromPoint`.
