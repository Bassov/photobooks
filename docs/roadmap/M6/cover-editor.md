# cover-editor

Tag: feature
Milestone: M6
Title: cover in the editor

## Scope

- [ ] Cover as a special spread: back / spine / front zones, hinge and wrap overlays, spine width from the profile and page count; spine text rotated 90°
- **Perf:** spine width change re-renders only the cover.
- **Browser check:** adding pages widens the spine on the cover; spine text stays centered.
- **UI ref:** `uikit#/feature/cover-editor`
- **UI kit:** `uikit/src/features/m6m8.tsx:326` (`cover-editor` demo + notes), `UI ref: uikit#/feature/cover-editor` — cover back/spine/front zones
