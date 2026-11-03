## Implementation

- [x] 1. Canvas text body: whole-line clip, overflow measure + store, `Empty text` editor-only, edit wrapper (transparent, 1 px outline, `Type text`, caret at end, grow to paper bottom). qa `text-frames: Title in a 36 px box…`, `…content edit grows…`
- [x] 2. Overflow chip in `FrameEl` (below / inside rule, hidden while editing and in preview); no handles / sel outline while editing. qa `text-frames: Overflow chip…`, `…edit mode…no handles`
- [x] 3. Text tool: click → 60 × 14 mm clamped to the 6 mm safe area, drag min 10 × 4.5 mm, press over an image frame creates, over a text frame edits; `""` content; draft until the first edit ends (empty → removed, else "Add text"). qa `text-frames: Text click…`, `…clamped…`, `…Esc…removes it`; demo step `editor-text-editing` (press over a photo)
- [x] 4. Inspector: overflow meta; TEXT textarea max-h 160 + scroll, focus ring inset 1 px #535152. qa `text-frames: inspector meta…`, `…textarea max-height 160…`
- [x] 5. `demo-capture.mjs` steps `editor-text-editing`, `editor-text-overflow`; qa.mjs text-frames block; demo baselines (69 steps, `.cache/agent/demo-baseline`).

## Manual test scenarios

1. `uikit#/demo` editor, spread 2–3, T, click the paper → one frame in edit mode, caret, no handles; Esc → removed.
2. T, drag on a photo, type a caption, Esc → selected with handles; Style Title → whole lines, Overflow chip below right, inspector meta.
