## Decisions

1. Whole lines: text node height = `floor(h / line) × line`; overflow = `scrollHeight > visible + 0.5`, re-measured after `document.fonts.ready`.
2. Overflow state lives in a tiny external store (`text-overflow.ts`, `useSyncExternalStore`), so the inspector meta follows the canvas measure without a doc field.
3. The chip is the existing Low-res chip look (kit tokens `bg-field`, `text-ink-warning`), in `FrameEl` at screen px: right 0, top `h + 4`; inside (right 4 / bottom 4) past the paper bottom; hidden while editing and in preview.
4. A new text frame is a draft (`st.preview`) until its first edit ends: text → `commit("Add text")` (one step); empty → `cancelPreview` (no step).
5. Grow while typing by DOM style (no doc re-render per key); the new `h` is written with the text on exit.
6. Tool Text in `onFrameDown`: over an image frame it starts the create gesture; over a text frame it edits.

## Touch-set & Test Plan

| File                                      | Reason                                  |
| ----------------------------------------- | --------------------------------------- |
| `uikit/src/sandbox/canvas.tsx`            | text body, chip, Text tool, edit chrome |
| `uikit/src/sandbox/text-overflow.ts`      | overflow store (new)                    |
| `uikit/src/sandbox/context-inspector.tsx` | overflow meta                           |
| `uikit/src/sandbox/sections.tsx`          | textarea max-h + focus ring             |
| `uikit/scripts/demo-capture.mjs`          | two steps                               |
| `uikit/scripts/qa.mjs`                    | text-frames block                       |

- Reuse: `snapRect` / `anchors` for the click point.
- Tests: qa.mjs text-frames block (empty / happy / interact) + demo baselines; kit only, no prod tests.
