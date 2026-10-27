# document-history

Tag: feature
Milestone: M3
Title: undo / redo
Status: done

## Scope

- [ ] Snapshot history with op-key coalescing and size limit; transient state excluded
- [ ] Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, toolbar buttons
- **Perf:** undo / redo is a pointer move over snapshots; only spreads with changed references re-render. Gate: hold Ctrl+Z through 50 steps — zero LoAF.
- **Browser check:** apply a template, place and swap photos, undo/redo step by step; each drop is one step.
- **UI ref:** `uikit#/feature/document-history`
- **UI kit:** `uikit/src/features/m3.tsx:236-245` (`document-history` demo + notes), `UI ref: uikit#/feature/document-history` — undo/redo toolbar + History panel, `uikit/src/components/ui/button.tsx`
