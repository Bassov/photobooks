# ui-editor-look-v93

Tag: feature
Milestone: M3
Title: Editor look: kit canvas surround, selection-only outline, quiet header
Status: done

## Scope

- [ ] Canvas surround `#C8CACB` with kit dot pattern behind the spread.
- [ ] Frames: no always-on white borders/shadows; black outline + handles only on the selected frame.
- [ ] Header quiet: **Change photo folder…** uses the secondary (tone) style, not black primary.
- Look only: no new editor capabilities (masters, tools, inspector, crop).
- UI ref: uikit#/demo (editor stage; `uikit/src/spread.tsx` Selection, `.canvas-dots`)
- **Browser check:** open a book in the editor; selected frame shows black outline + 8 handles, others none; dots visible around the spread; no page-level scroll.
