# kit-gaps

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item kit-gaps
Status: done

## Scope

- [x] Kit `#/demo` editor: Del / Backspace deletes the selected frame or the whole selection (`uikit/src/sandbox/viewport.tsx` editor keys, beside the arrows); locked frames stay; ignored while editing text or with focus in an input / textarea (Designer decision, multi-select-move review2 on #417: "Next kit pass: port to the kit"; prod is the target).
- [x] Kit `#/demo` editor: Arrow / Shift+arrow with every selected frame locked moves nothing and shows the same "all locked" status message the drag shows (`uikit/src/sandbox/canvas.tsx`); one shared message constant for drag and nudge.
- [x] Regression: Playwright e2e on `/uikit/#/demo` — Del on 1 frame → count −1, on 2 → −2, a locked frame survives, Del inside the text editor edits text only; all-locked + ArrowRight → frame rects unchanged and the status text visible (text + box > 0).
- **Browser check:** `#/demo` editor with frames: select a frame → Del removes it; lock a frame → Del keeps it; lock all selected → ArrowRight shows the locked status, nothing moves.
- **Kit components:** `uikit#/feature/frame-selection-handles` notes (Keys: Del; Edge: all locked → status).
- **Hard nos:** no other kit visual change; no edits to `src/`, `uikit/scripts/demo-capture.mjs`, `uikit/scripts/qa.mjs`, `uikit/src/demo-parts/*`, `uikit/src/features/pages.tsx`, `uikit/src/kit/pages.json`; no Designer review (kit catches up to prod).
- **Test:** Playwright e2e on the kit demo (DOM counts, rects, status text box).
