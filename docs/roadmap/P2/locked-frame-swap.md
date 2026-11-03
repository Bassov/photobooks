# locked-frame-swap

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item locked-frame-swap

## Scope

- [ ] Click-to-swap (pick a frame, then click / Enter another) refuses when the source or the target frame is locked: no swap, status shows the frame-locked message, both lock flags unchanged, no undo step
- [ ] Core photo ops never change a locked frame's photo: `swapFrames`, `placeAsset`, `replaceAsset` and `fillSpread` leave a locked frame as is (multi-drop skips locked empty frames); swap / unplace / gallery removal keep the frame's own fields (`locked`, rotation, style) instead of rebuilding `{ id, rect, z }`
- **Bug rule:** every swap caller and every path that writes a photo into a frame is fixed or listed in the PR body with a reason (context menu owned by `multi-select-inspector`)
- **Done when:** unit tests red before the fix, green after: locked source, locked target, unlocked pair still swaps; lock survives swap / unplace. Repo checks green; full e2e at the end; PR body: caller table
- **Perf:** N/A — one `locked` lookup per click; ops stay O(frames)
- **Browser check:** lock a filled frame, select it, click another filled frame → photos stay, status reads the frame-locked message, frame still locked; same with the lock on the target; unlocked pair still swaps
- **Hard nos:** no edits in `FrameSections`, Inspector files, `FrameContextMenu`, `frameArrange`, `uikit/` (other lanes)
- **Source:** Designer multi-select review 2026-11-03
