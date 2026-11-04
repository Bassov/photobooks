# text-frames-editor

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item text-frames-editor

## Scope

- [ ] Prod editor part of text frames (Designer `text-frames` spec, Items 3): the Text tool creates text frames (drag ≥ 3 px draws the frame draft with snapping, min 10 × 4.5 mm; a click makes 60 × 14 mm clamped to the page's 6 mm safe area; starts on paper or over a photo frame; new = Caption, left, empty; editing starts at once; the tool returns to Select; an empty new frame is removed on exit with no history step)
- **Edit overlay:** transparent textarea at the frame rect in the style font (caret and outline `#232223`, selection `#cacaca`, placeholder `Type text` at .4), the box grows to whole lines while typing (capped at the paper bottom), only the edited frame re-renders; edit mode shows a 1 px outline and no handles
- **Overflow chip:** amber `Overflow` chip (`text-overflow-chip`) at a constant screen size, right under the frame, or inside at right 4 / bottom 4 near the paper bottom; editor only (never in Preview or thumbnails), hidden while that frame is edited
- **Keys:** double-click or Enter edits (caret at the end), Esc or Ctrl/⌘+Enter leaves and keeps the frame selected, Esc again deselects; a Text press on a text frame edits it
- **History:** "Add text" = create + first edit; "Edit text" per later edit session; inspector typing coalesces per focus; "Text style" / "Align text"
- **Drops:** text frames are not gallery-drop targets nor swap targets or sources (drops fall through to the photo frame below)
- **Text inspector:** header `Text` (meta `Text overflows the frame` while overflowing), TEXT section (Style Title · Caption · Body, Align + hint `dbl-click to edit on canvas`, Text textarea growing to 160 px), POSITION & SIZE and ARRANGE collapsed, Delete frame; no Live block
- **Out:** Live captions (`live-captions`), PDF text (`pdf-captions`), kit changes (`text-frames-kit`, merged)
- **Browser check:** with Text, click and drag on a `?fixture=` spread create text frames, typing shows on the canvas, reload keeps it; Title restyle shows the chip and the inspector warning, Preview shows no chip; a layout apply keeps the text; the list thumbnail shows it
- **Perf:** 200 typed characters keep INP ≤ 100 ms (uncontrolled textarea, commit on exit)
- **Test:** new `e2e/text-frames.spec.ts` (click + drag create, reload keeps; empty removed; Enter edits; Title → chip + warning, no chip in Preview; layout keeps text; thumbnail shows text; INP ≤ 100 ms over 200 typed chars); unit for the gesture, the edit store, history steps, drop exclusion and the inspector
- **Stay green unchanged:** `e2e/design-r2-canvas-toolbar.spec.ts:101`, `e2e/design-r2-toolbar-kitset.spec.ts:18`, `src/editor/editorHardNos.test.ts:36`, `src/core/text/textFrame.test.ts:184`
- **Evidence:** DOM measurements for the inspector dy (136 / 170 / 206) and the chip geometry in the PR body
- **Design:** `photobooks-orch/shared/design/text-frames/spec.md` (READY 2026-11-04)
