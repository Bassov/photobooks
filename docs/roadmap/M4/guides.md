# guides

Tag: feature
Milestone: M4
Title: guides

## Scope

- [ ] Editor overlay layer above `SpreadView` (editor-only, never in output); guides are its first content
- [ ] Drag from a ruler to create a guide; move, delete
- [ ] Show / hide guides, snap on / off (view state)
- **Perf:** guide drag is a `transform` in rAF, committed at gesture end.
- **Browser check:** pull guides from both rulers, move and delete one, zoom — guides stay aligned with rulers; guides never appear in presentation mode.
- **UI ref:** `uikit#/feature/guides`
- **UI kit:** `uikit/src/features/m4.tsx:39-42` (`guides` demo + notes), `UI ref: uikit#/feature/guides` — drag-from-ruler guides overlay
