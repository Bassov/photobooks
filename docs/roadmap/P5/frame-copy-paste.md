# frame-copy-paste

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item frame-copy-paste

## Scope

FC4 of the Designer Spec frame-copy-paste (Owner Q-20, Q-23): prod frame Copy / Cut / Paste / Paste in place / Duplicate keys on the canvas, values = kit (`uikit/src/sandbox/clipboard.ts`, `viewport.tsx` `useEditorKeys`) on top of the merged core ops (`src/core/ops/clipboard.ts`). Alt-drag duplicate is out (FC5 `frame-alt-duplicate`).

- [ ] `src/editor/frameClipboard.ts` (+ unit test): in-tab mirror of the last payload; `copySelectedFrames` / `cutSelectedFrames` / `pasteFrames({ inPlace })` / `duplicateSelectedFrames()`; Ctrl+D step memory (D8); `installFrameClipboard()` installed by the editor shell next to `installEditorKeys`.
- [ ] Keys: document `copy` / `cut` / `paste` events (`application/x-photobooks-frames+json` + mirror), Ctrl/⌘+Shift+V keydown sets in-place, Ctrl/⌘+D duplicates (preventDefault only with a canvas frame selection). Guards: typing targets, text edit, spread list / filmstrip, Site preview. New frames become the selection on the target spread (selection's spread, else active); paste / duplicate end crop mode; reveal scroll (≥50 % visible, else least scroll; no zoom change).
- [ ] Statuses "Copied frame" / "Copied N frames" (2000 ms, cleared only if still ours); undo labels "Cut / Paste / Duplicate frame" / "… N frames".
- [ ] e2e `e2e/frame-copy-paste.spec.ts`: Ctrl+C status, Ctrl+V +5 mm (10.6 px at Fit ±0.5), other spread in place, page 1 shift, Ctrl+Shift+V, Ctrl+D repeat, undo = one step each, Caption typing keeps native copy/paste.
- **Done when:** every Keys-table row except Alt+drag works in prod with the kit's values, each covered by the e2e above; framestyle-arrange:59, site-preview-mode:267, layout-grids-snap-wire:51 and parent-overrides\* pass unchanged; `pnpm roadmap check` green.
- **Browser check:** select a frame on an interior spread, Ctrl+C shows "Copied frame", Ctrl+V adds a copy 5 mm down-right as the new selection, Ctrl+Z removes it in one step.
