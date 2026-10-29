# inspector

Tag: feature
Milestone: M4
Title: numeric properties

## Scope

- [ ] Right `Panel`: position, size, rotation, crop
- **Perf:** inspector subscribes to the selection only; live values during a drag come from the transient gesture state, throttled to rAF.
- **Browser check:** typing values moves frames precisely; values stay in sync with dragging.
- **UI ref:** `uikit#/feature/inspector`
- See also: inspector-frame-sections (visual subset)
- **UI kit:** `uikit/src/features/m4.tsx:67-70` (`inspector` demo + notes), `UI ref: uikit#/feature/inspector` — numeric Frame/Spread/Book inspector, `uikit/src/sandbox/inspector.tsx`, `uikit/src/components/ui/numberfield.tsx`
