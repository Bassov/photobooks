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
- **UI ref:** `kit v0.9.3 #/feature/document-history (removed in kit v0.10.0, no replacement)`
- **UI kit:** none in v0.10.0 (kit v0.9.3 `#/feature/document-history (removed in kit v0.10.0)`, removed) — undo/redo toolbar + History panel, `uikit/src/components/ui/button.tsx`
