## Decisions

1. No schema bump (v11 is taken): `ensureDefaultParent` runs in `createEmptyLibraryBook`, the session book and `activateLoadedBook`; the open-time fill is not marked dirty.
2. The default is never deleted or cleared while parents exist (core guards).
3. The spread Master control is always `src/ui/Select` (Owner amendment), hidden only without parents.
4. `masterUsageLabel` and `spreadMasterStatus` live in `inspectorModel.ts`.
5. Kit: the default master lives in the kit `Doc` (`defaultMaster`, undoable via `st.update`, saved with the book) instead of module state. The kit ships in this PR (kit rule in the roadmap Scope).
6. Tokens from `docs/design.md` / `editorChromeTokens.ts` (SUB, T, FIELD, `--radius-xs`); new `--text-3xs`, `--t-tag`, `--t-field-hover`; skill `ui-review` covers select, status and tag.

## Touch-set & Test Plan

| Path                                       | Why                           |
| ------------------------------------------ | ----------------------------- |
| `src/core/parentSpreads.ts`                | ensureDefaultParent, guards   |
| `src/core/index.ts`                        | export                        |
| `src/editor/projectSession.ts`             | new book fill                 |
| `src/editor/bookStore.ts`                  | session book fill             |
| `src/editor/session/libraryActivation.ts`  | open-time fill                |
| `src/editor/MastersPanel.tsx`              | intro, tag, row menu          |
| `src/editor/MasterSection.tsx`             | head sub, hint, Make default  |
| `src/editor/InspectorControls.tsx`         | head children slot            |
| `src/editor/InspectorControls.css`         | hint, Make default button     |
| `src/editor/inspectorModel.ts`             | labels                        |
| `src/editor/SpreadSections.tsx`            | select, status, Edit master   |
| `src/editor/SpreadSections.css`            | status line                   |
| `src/editor/EditorShell.css`               | intro, tag                    |
| `styles/tokens.css`                        | new tokens                    |
| `docs/design.md`                           | new tokens                    |
| `uikit/src/sandbox/model.ts`               | kit default state             |
| `uikit/src/sandbox/v7.tsx`                 | kit master head, Defaults     |
| `uikit/src/sandbox/chrome.tsx`             | kit Masters list 274-330      |
| `uikit/src/sandbox/context-inspector.tsx`  | kit select, status            |
| `uikit/scripts/qa.mjs`                     | kit qa picks + default-master |
| `e2e/fixtures/spreadMaster.ts`             | select helpers                |
| `e2e/default-master.spec.ts`               | new e2e                       |
| `e2e/parent-spreads.spec.ts`               | select picks                  |
| `e2e/parent-spreads-edit.spec.ts`          | select picks                  |
| `e2e/parent-spreads-inspector.spec.ts`     | select picks, default head    |
| `e2e/parent-spreads-guides.spec.ts`        | select picks, Master A        |
| `e2e/master-spread-both-pages.spec.ts`     | select picks                  |
| `e2e/kit10-masters.spec.ts`                | fresh book has Master A       |
| `e2e/kit10-inspector-frame-spread.spec.ts` | Use master on a fresh book    |
| `e2e/layout-grids-settings.spec.ts`        | Use master on a fresh book    |
| `e2e/design-frame-crop-masters.spec.ts`    | Master A on the canvas        |
| `e2e/design-r2-layout-picker.spec.ts`      | section height with select    |

- Unit: core per roadmap Tests; `inspectorModel` labels; panel / inspector components.
- E2E: per roadmap Tests (empty, happy, interact), with select width 268 and status height 16.8.
