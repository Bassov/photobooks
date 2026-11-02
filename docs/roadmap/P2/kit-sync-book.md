# kit-sync-book

Tag: feature
Milestone: P2
Title: Kit sync W4: pastedown caption, cover inspector, library card title

## Scope

Kit-only (`uikit/`, `#/demo`): port prod's accepted decisions from the Designer kit-sync Spec items 9–11 (tracker KS9–KS11). Prod is the target; `src/` is untouched.

- [ ] KS9 (Q7): remove the endpaper canvas caption «Pastedown · glued to … board».
- [ ] KS10 (Q1/Q2): cover inspector Title font / Cover / Finish become select fields (h 36, radius 8, bg rgb(215,215,215), chevron 16, right edge 1424); Cover editable. Read-only pills (Paper white, Hardcover) right-aligned next to their note.
- [ ] KS11 (Q6): library card title over the photo rgb(46,44,45) → rgb(245,245,245).
- **Browser check:** `#/demo` cover step: row tops Title font 285.44, SPINE 343.86, Spine width 415.70, Direction 450.55, BACK 504.39, Fill 580.23, MATERIAL 634.08, Finish 718.50 (±1 px); Paper white x 1272.72, Hardcover x 1295.45; library step card title rgb(245,245,245).

## Done when

- DOM numbers above match on the `#/demo` cover and library steps (±1 px); kit qa assertions pin them.
- Demo baselines regenerated for affected steps; kit qa green; repo checks green.
- PR body: before/after numbers; tracker ids KS9–KS11.
