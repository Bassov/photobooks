# frame-copy-paste-core

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item frame-copy-paste-core

## Scope

- [ ] Core part of the Designer feature "frame copy / paste / duplicate" (Owner Q-23 2026-11-20 19:13), Must FC3 only: Designer spec `frame-copy-paste` D3–D8, "Payload", "Core". Pure core: no editor keys, no DOM, no UI. Kit is `frame-copy-paste-kit` (FC1, reference maths in `uikit/src/sandbox/clipboard.ts`); prod keys and undo labels are `frame-copy-paste` (FC4).
- [ ] `src/core/ops/clipboard.ts` (new): `FramesPayload` (v 1), `framesPayload(book, spreadId, frameIds)`, pure `pastedRects(book, targetSpreadId, payload, { inPlace, offset? })` per D3 (+5/+5 mm steps ≤ 20 while a rect is taken ±0.01 mm; `inPlace` never steps), D4 (single page slot mapping, ±W onto the page, clamp to pages + bleed, centre when bigger, group moves as one) and the D8 offset; a pure helper for the D7 "N photos aren't in this book" count.
- [ ] `BookOp` + `applyBookOp`: `pasteFrames` (`spreadId, payload, inPlace, ids?`), `duplicateFrames` (`spreadId, frameIds, dx, dy, ids?`, = paste of its own payload at +dx/+dy with D3 steps), `removeFrames` `cut?: true` (label only). Copies per D5 (no `locked` / `overridesId`, new ids = `ids` else `nextFrameId` in order, on top in z order, spread detached), D6 (caption anchors remapped / kept / static with the payload text), D7 (asset by `contentHash`, else `sourceRootId` + `relativePath`, else empty; unknown `frameStyleId` dropped).
- [ ] Export from `src/core/index.ts`; both ops in `src/core/testing/bookModel.ts` and `src/core/ops/sequence.pbt.test.ts`.
- **Done when:** unit tests cover D3 stepping (taken → +5/+5, 20-step cap, `inPlace` never steps), D4 for page 1 (right single) and the last page (left single) incl. ±W and clamp / centre, D5 flags / ids / z / detached, D6 three cases, D7 remap by hash, by path, empty + count, D8 offset from a previous duplicate and (0, 0) → +5/+5. PBT: count = payload count; ids unique on the spread; source frames unchanged; pairwise deltas kept; bbox ⊂ area whenever it fits; `inPlace` on the source spread ⇒ rects equal; no dangling `anchorFrameId`. `sequence.pbt.test.ts` runs both ops against the model.
- **Browser check:** none (pure core; no UI).
- **Hard nos:** no `src/editor/**` (undo labels go to FC4), `src/render/**`, `uikit/**`, `styles/**`, `src/site/**`, `e2e/**`, `.github/workflows/**`, `playwright.config.ts`, `scripts/**`, `stryker.config.mjs`.
- **Test:** `src/core/ops/clipboard.test.ts`, `src/core/ops/clipboard.pbt.test.ts` (new), `src/core/ops/sequence.pbt.test.ts`.
- **Depends:** none (parallel with `frame-copy-paste-kit`).
