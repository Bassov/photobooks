## Implementation

- [x] 1. Core `ensureDefaultParent` + default guards in `removeParent` / `setDefaultParent`; unit tests (`parentSpreads.edit.test.ts`, `ops/grid.test.ts`)
- [x] 2. New book and opened books get the default (`createEmptyLibraryBook`, session book, `activateLoadedBook`); unit tests (`projectSession.test.ts`, `libraryActivation.test.ts`, `bookStore.test.ts`)
- [x] 3. Masters panel: intro note, Default tag, Make default menu item, Delete disabled on the default (`LeftPanel.test.tsx`)
- [x] 4. Master inspector: default head sub, unused hint, Make default button (`MasterSection.test.tsx`, `inspectorModel.test.ts`)
- [x] 5. Spread inspector: Master select (always), status line, Edit master (`SpreadSections.test.tsx`)
- [x] 6. Kit: default master state, select, status, tag, intro, row menu, master head, Make default; kit qa picks (`uikit/scripts/qa.mjs` default-master block)
- [x] 7. E2E `e2e/default-master.spec.ts` + existing master specs moved to the select / Master B

## Manual test scenarios

1. New book → spread 2–3 → inspector select `Master A · default`, status "Book default"; Edit master → Masters mode with Master A picked.
2. Masters → New master → Make default → Master B tagged Default, intro names Master B, spreads show "Book default" with Master B.
3. Spread 2–3 → None → status "No master on this spread"; Master B head "Default · 4 of 6 pages".
