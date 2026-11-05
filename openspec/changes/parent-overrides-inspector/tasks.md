## Implementation

- [x] 1. `eyeOff` glyph; pure `src/editor/parentChanges.ts` (copy lookup, ordered named rows) + `onSpreadPage` export, with unit tests. — `parentChanges.test.ts`, `Icon.test.tsx`
- [x] 2. PO4 `FrameContextMenu.tsx`: copy menu rows; parent item / parent guide menu via `parentHitAt`; tests in `FrameContextMenu.test.tsx`. — 9 cases in "on parent items and override copies"
- [x] 3. PO6 `Inspector.tsx` head meta + ↺ (CSS in `EditorShell.css`), tests in `Inspector.test.tsx`. — "Inspector head of an override copy" (photo, text, own frame)
- [x] 4. PO7 `SpreadSections.tsx` "Changed from {parent}" block + Reset all (CSS in `SpreadSections.css`), tests in `SpreadSections.test.tsx`. — 'MasterSpacingSection "Changed from {parent}"'
- [x] 5. `e2e/parent-overrides.spec.ts`: menu override / hide, head ↺, row ↺, Reset all, no list without changes. — two new tests, green locally

## Manual test scenarios

1. Painter fixture `&parent=a`, spread 1: right-click the logo → "Override on this spread" → copy selected with badge; inspector head "Override · Master A"; ↺ → copy gone, inspector on the spread.
2. Right-click the logo → "Hide on this spread" → logo gone; spread inspector lists "Photo frame · hidden"; row ↺ → logo back, list gone.
3. Override the logo by Ctrl+Shift drag → row "Photo frame · override"; Reset all → logo back at the parent position, no list; a spread without changes shows no list.
