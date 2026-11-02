## Decisions

1. Reuse the dormant `features.stack` path (`Stack` in `viewport.tsx`), on in `DEMO_FEATURES`. The stack shares the single-spread Fit (`fitScale`) and the 0.25–8 zoom clamp, so the roadmap numbers hold. Node views and rulers keep the single-spread camera; `useSize(key)` re-attaches when the element swaps.
2. Gap, labels and pill follow prod `STACK_GAP_RATIO` and `pageLabelsModel`: `STACK_GAP` 104/588, fixed-height `GapDrop` (no growth on drag), `PageLabels` `text-2xs leading-none mt-2`, hidden under `LABELS_MIN_GAP` 19; pill hidden under `PILL_MIN_GAP` 70.
3. A current spread out of view is centred (prod `centerSpreadScroll`); `SpreadSurface` marks it `data-current` for qa / capture selectors.
4. K1: `useDragLive` in `FrameEl` drops the drop chip and dimmed source on Esc / pointerup / dragend / drop (a cancelled native drag sends no dragleave / dragend); `dragstart` re-arms.
5. Size pill deleted from `Handles`. Tokens: kit `--radius-md` 8, `--text-2xs` 11, white/50; no new tokens.

## Touch-set & Test Plan

| File                              | Why                                           |
| --------------------------------- | --------------------------------------------- |
| `uikit/src/sandbox/viewport.tsx`  | stack, gap, labels, pill                      |
| `uikit/src/sandbox/canvas.tsx`    | size pill, `data-current`, K1                 |
| `uikit/src/demo-parts/editor.tsx` | `stack: true`                                 |
| `uikit/scripts/demo-capture.mjs`  | current-spread selectors, `probe` hook        |
| `uikit/scripts/qa.mjs`            | KS2–KS5 + K1 checks; current-spread selectors |

Tests: kit `qa.mjs` (ratios), demo-capture probe at 1440×900 (absolute numbers); `demo:baseline` regenerated outside the repo (not versioned). No `src/` → no unit / e2e change.
