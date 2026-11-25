# qa-guide-frame-move

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item qa-guide-frame-move

## Scope

- [ ] QA-6 (prod QA 2026-11-25, PR #725): the guide's "Frames and crop" step 1 (`uikit/src/kit/guide/content.ts`) says "Click a frame; drag to move", but a filled frame's body drag is the photo swap drag and never moves the frame (`openspec/specs/pasteboard/spec.md`, "Swap, move, and unplace"). The step now says: an empty frame moves by body drag; a photo frame's body drag moves its photo; a photo frame moves with the arrow keys (`Shift`: 10 mm), X / Y in Position & size, or as part of a multi-frame selection drag. Copy only; no product behaviour change.
- [ ] No e2e or kit test pins the old sentence; `uikit:build` + `uikit:qa:quick` pass.
- **Browser check:** open the kit guide (`/uikit/` guide, chapter "Frames and crop"): step 1 reads the new text; in the editor, dragging a photo frame's body swaps its photo, arrow keys nudge it.
