# frame-copy-paste-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item frame-copy-paste-kit
Status: done

## Scope

- [x] Kit part (`#/demo`) of the Designer feature "frame copy / paste" (Owner Q-23 2026-11-20 19:13), Must FC1 only: Designer spec `frame-copy-paste` Keys table, D3–D9, statuses, "Kit changes" minus the Alt-drag duplicate (FC2, `canvas.tsx`, later item). Core is `frame-copy-paste-core`; prod is `frame-copy-paste`.
- [x] `uikit/src/sandbox/clipboard.ts` (new): payload, `pastedRects` (D3 / D4 / D8 on the kit frame model), paste, duplicate, step memory, `resetClipboard()`.
- [x] `uikit/src/sandbox/viewport.tsx` `useEditorKeys`: Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+Shift+V / Ctrl+D per the Keys table (+ document copy / cut / paste listeners); fields keep native copy / paste; Ctrl+D on a spread row duplicates the spread. Status pill via the existing `st.setStatus`.
- [x] `uikit/src/demo-parts/editor.tsx`: a new demo session (`__demo.reset()` remounts the editor) calls `resetClipboard()` (one line).
- [x] `uikit/scripts/demo-capture.mjs`: steps after `editor-frame-drag-cancelled`: `editor-frame-copied`, `editor-frame-pasted`, `editor-frame-pasted-other-spread`, `editor-frame-duplicated`, `editor-frame-step-repeat`; re-baseline only the shots these steps add or change.
- **Done when:** all 5 keys work in `#/demo` per the Spec Keys table and D3–D9 (DOM rect deltas ±0.5 px in the new e2e spec): Ctrl+C status, Ctrl+V +5/+5 mm (then +10/+10), another spread in place, Ctrl+Shift+V in place, Ctrl+D step repeat, Ctrl+X removes unlocked frames (all locked → lock status), undo = one step each, Ctrl+D on a spread row duplicates the spread, the Caption input keeps native copy / paste. `e2e/kit-parent-overrides.spec.ts:119` and the other Spec "Must stay green unchanged" kit specs stay green unchanged. New demo steps captured.
- **Browser check:** kit `#/demo` via `e2e/kit-frame-copy-paste.spec.ts` (new; `qa.mjs` is frozen).
- **Hard nos:** no `src/**`; no `uikit/src/sandbox/chrome.tsx`, `uikit/src/sandbox/store.tsx`, `uikit/src/sandbox/canvas.tsx`, `uikit/src/sandbox/v7.tsx`, `uikit/src/index.css`, `uikit/src/features/**`, `uikit/scripts/qa.mjs`, `e2e/kit-filmstrip*.spec.ts`, `.github/workflows/**`, `playwright.config.ts`.
- **Test:** e2e `e2e/kit-frame-copy-paste.spec.ts` (new).
- **Depends:** none (parallel with `frame-copy-paste-core`).
