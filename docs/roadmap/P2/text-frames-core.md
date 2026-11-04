# text-frames-core

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item text-frames-core
Status: done

## Scope

- [ ] Prod core + render part of text frames (Designer `text-frames` spec, Items 2): text frames resolve with text / style / align and paint on the canvas, list thumbnails and Preview; layouts re-lay image frames only; ops `addTextFrame`, `editText` (grow to whole lines, capped at the paper bottom), `setTextStyle`, `setTextAlign` with history labels; photo caption font-size = 3.1 mm × px/mm (prod bug, was a fixed 11 px)
- **Text styles:** Title Lora 9 mm / 500 / 1.15, Caption Inter 3.1 mm / 400 / 1.4 (default), Body Inter 3.6 mm / 400 / 1.5; colour `#232220`, `pre-wrap`, `overflow-wrap: anywhere`; visible height = whole lines only
- **Out:** editor UI (Text tool, edit overlay, overflow chip, keys, Text inspector, drop exclusion in the editor) is `text-frames-editor`
- **Browser check:** a `?fixture=` book with a text frame shows its text on the canvas, in the list thumbnail and in Preview; applying a layout keeps the text box; the photo caption scales with the zoom
- **Perf:** text frames add no per-frame effects; resolve is pure and memo-friendly
- **Test:** unit for the 4 ops + growth, whole-lines height, style table, text node render, layout apply keeps text (built-in and saved layout), caption font-size; full e2e at the end
- **Stay green unchanged:** `src/editor/editorHardNos.test.ts:36`, `src/core/text/textFrame.test.ts:184`, `e2e/design-r2-canvas-toolbar.spec.ts:101`, `e2e/design-r2-toolbar-kitset.spec.ts:18`
- **Design:** `photobooks-orch/shared/design/text-frames/spec.md` (READY 2026-11-04)
