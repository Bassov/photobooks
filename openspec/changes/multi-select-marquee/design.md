## Decisions

1. **Start in `frameGesture.ts`, not `Pasteboard.tsx`.** A `marquee` session in `installFrameGesture`'s capture `pointerdown` shares the Hand / Space-pan / crop / typing guards and Esc handling with the other sessions. `Pasteboard.tsx` stays untouched on purpose (the roadmap listed it): its click still activates the spread and clears the selection; the capture listener snapshots the selection first. Target: paper under the press, else the spread of `pasteboardClickSpreadId` (scrollbars excluded).
2. **Hit index in `snapIndex.ts`.** Painted AABB per own frame (rotation included, `paintedBox` moves here), sorted by left edge, binary search + overlap filter; built once per press, so parent and other-spread frames never enter.
3. **Live paint without React, per pointermove.** Chrome coalesces pointermove to one per frame; each runs under `measureHandlerSync('frame-gesture')` (2 ms budget, gated in e2e): hit query, `data-marquee-hit` attribute diff, one fixed screen-px box clipped to the scrollport.
4. **Release / cancel.** `setFrameSelection` (new) = hits, ∪ previous with Shift when it is on the target spread (else the hits alone). Esc / pointercancel restores the previous selection. Look and tokens: spec + `docs/design.md`.

## Touch-set & Test Plan

| File                             | Why                             |
| -------------------------------- | ------------------------------- |
| `src/editor/frameGesture.ts`     | marquee session                 |
| `src/editor/marquee.ts`          | target / paint / commit         |
| `src/editor/snapIndex.ts`        | hit index                       |
| `src/editor/frameSelection.ts`   | `setFrameSelection`             |
| `src/render/SpreadView.css`      | box + hit outline               |
| `uikit/src/sandbox/canvas.tsx`   | kit Shift-union, live hits, Esc |
| `uikit/src/sandbox/viewport.tsx` | kit pasteboard marquee          |
| `uikit/src/features/pages.tsx`   | kit notes                       |
| `docs/design.md`                 | marquee tokens                  |

- Unit: `snapIndex.test.ts`, `Pasteboard.click.test.tsx`, `frameGesture.test.ts`.
- e2e: `multi-select.spec.ts` (+ frame-budget gate).
