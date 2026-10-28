## Implementation

- [x] 1. Core ops `addFrame` / `removeFrames` / `setFrameRect` (template cleared, ≥ 5 mm) — `src/core/ops/frames.test.ts`
- [x] 2. Anchor-index snapping (frames, guides, equal gaps, Alt) — `src/editor/snapIndex.test.ts`
- [x] 3. Frame tool draw + commit/select/return to Select; < 5 mm no-op — `src/editor/frameGesture.test.ts`, `e2e/free-frames.spec.ts`
- [x] 4. Empty-frame move with live snap lines — `frameGesture.test.ts`
- [x] 5. Empty frames selectable; Delete / Backspace removes the selected frame — `editorKeys.test.tsx`, `frameSelection.test.ts`, `dropTargets.test.ts`
- [x] 6. Filmstrip drop fills a drawn frame; perf gate (`frame-gesture` p95, zero LoAF) — `e2e/free-frames.spec.ts`

## Manual test scenarios

1. F → drag ≥ 5 mm → selected frame appears, tool returns to Select; Delete removes; Undo restores.
2. Drag < 5 mm → no frame; Frame tool stays active.
3. Draw near another frame / guide → snap line + `snap · …` label; hold Alt → none.
4. Drag a photo from the filmstrip onto the empty frame → fills.

Evidence: `pnpm agent manual-qa` was denied by the harness (not run). OK via `e2e/free-frames.spec.ts` (Chromium): scenarios 1–4, empty-frame Select-tool drag with snap + Alt, and the dense-spread drag gate (zero LoAF, `frame-gesture` p95 within budget at 2× CPU throttle).
