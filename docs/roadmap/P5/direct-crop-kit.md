# direct-crop-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item direct-crop-kit
Status: done

## Scope

- [x] Kit part (`#/demo`) of the Designer feature "direct crop" (Owner Q-18 2026-11-20 18:52: 3 items: kit, core, prod). Designer Spec `walkthrough-ux-review` §A (table, hit order, show/hide timings, pinned state, small frames, undo) and "Kit changes" first two bullets. Core op is `direct-crop-core`; prod is `direct-crop`.
- [x] `uikit/src/sandbox/canvas.tsx`: chrome on a selected single photo frame: content grabber (28 px circle), photo layer (ghost .3, extent outline, 4 corner photo handles 12 px, active handle style); frame handles crop with keep-photo semantics (Fill scales up only when it would stop covering, anchored at the opposite edge; Shift keeps aspect); photo corner drag scales aspect-locked about the opposite corner (Alt: centre); Fill min = cover, Fit may go below cover and switches to Fill past cover; ghost drag pans; rotate chip (angle, Shift 15° steps, snap 0/90/180/270 within ±2°); hit order as Spec; show 120 ms / hide 400 ms after >12 px outside, instant under reduced motion; all chrome in screen px. Small frames: side <40 px hides that side's mid handles, <64 px no grabber.
- [x] Pinned state (double-click / Crop): photo layer stays, "Crop · N%" tag, 2 px `--crop` outline, frame handles hidden; Tab cycles the 4 photo handles (focus-visible outline 2px #3A3839 offset 2); arrows nudge 1 px (Shift 10); Esc / click outside exit.
- [x] Kit keep-photo resize math next to the kit crop math (`uikit/src/sandbox/model.ts` or where it lives).
- [x] `#/demo` steps in `uikit/scripts/demo-capture.mjs`: `editor-frame-selected` (grabber), `editor-crop-mode` (pinned with handles), new `editor-photo-layer-hover`, `editor-photo-scaled`, `editor-frame-cropped-by-edge`; re-baseline those steps (not `editor-filmstrip-resized`, filmstrip lane Q-19).
- **Done when:** selecting a kit photo frame shows the grabber at the visible photo centre (`elementsFromPoint` at its centre hits the grabber); dragging a frame edge handle changes the frame and leaves the image page rect unchanged (DOM rect delta ≤0.5 px) while it still covers in Fill. Photo corner drag scales with aspect locked (ratio error <0.5 %), cannot go below cover in Fill; in Fit, growing past cover switches the kit inspector to Fill. Grabber hover shows the photo layer (ghost opacity 0.3, 4 photo handles); hit order per Spec verified in the spec file (photo handle over frame handle where they overlap). Rotate chip shows the angle while rotating; Shift snaps to 15° steps. Pinned: frame handles hidden, 4 photo handles + grabber visible, Tab reaches each photo handle, arrow nudges 1 px. A frame side <64 screen px: no grabber; <40 px: that side's mid handles hidden. Changed e2e specs green locally.
- **Browser check:** kit `#/demo` via `e2e/kit-direct-crop.spec.ts` (paint check with `elementsFromPoint`). `e2e/kit10-crop.spec.ts` drives the prod editor, so it changes with the prod item, not here.
- **Hard nos:** no `src/**`; no `uikit/src/sandbox/chrome.tsx`, `uikit/src/sandbox/store.tsx`, `uikit/src/demo-parts/editor.tsx` (filmstrip lane), `uikit/scripts/qa.mjs` (frozen), `uikit/src/kit/pages.json`.
- **Test:** e2e `e2e/kit-direct-crop.spec.ts` (new).
- **Depends:** none (parallel with `direct-crop-core`).
