# arrange-lock

Tag: feature
Milestone: M4
Title: stacking and locking

## Scope

- [ ] Z-order (bring forward / backward / to front / to back) and lock in the inspector, context menu and shortcuts
- **Perf:** a z-order change re-renders only its spread.
- **Browser check:** send a frame behind another and lock it; a locked frame ignores drag and drop.
- **UI ref:** `uikit#/feature/arrange-lock`
- **UI kit:** `uikit/src/features/m4.tsx:71-74` (`arrange-lock` demo + notes), `UI ref: uikit#/feature/arrange-lock` — z-order + lock in inspector
