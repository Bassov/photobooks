## Decisions

1. **Store** `printProfilesStore.ts` = `savedTemplates.ts` pattern (library-bound customs + default id, serial `library.json` writes, failure status). `?printProfiles=kit` (test builds) seeds one custom so e2e / perf have a second profile (catalog is Generic only).
2. **`PrintProfile.basedOn?`** keeps "Based on {base}." across reloads (zod strips unknown keys).
3. **One undo step**: `HistorySnapshot` gains `printProfile`. Save of a custom dispatches the only new op, non-undoable `refreshPrintProfile` (D6 snapshot refresh). `setPrintProfile`, `printIssues`, `pageCountRange`, library fields and the new-book default already exist (core item).
4. **Customs first (D6)**: `resolveSpread` option `printProfiles`; low-res callers pass the store list; paint key adds dpi warn/min, so a switch repaints only when marks can change.
5. **Pure draft rules** `printProfileDraft.ts`: strings ↔ profile, core `editableProfileIssues` + non-negative / whole-number rules, `(copy N)` names, New profile from Generic.
6. `ui/Select` gains optional `group` (optgroups); dialog on `ui/Dialog` (560, `max-height: calc(100vh - 96px)`, body scrolls).

## Touch-set & Test Plan

| File                                         | Why                          |
| -------------------------------------------- | ---------------------------- |
| `src/core/print/profileSchema.ts`            | `basedOn`                    |
| `src/core/ops/bookSettings.ts`               | `refreshPrintProfile`        |
| `src/core/ops/applyBookOp.ts`                | op                           |
| `src/core/geometry/resolveSpread.ts`         | customs                      |
| `src/core/index.ts`                          | export                       |
| `src/editor/printProfilesStore.ts`           | store                        |
| `src/editor/printProfileDraft.ts`            | editor rules                 |
| `src/editor/PrintPresetsSection.tsx`         | Settings section             |
| `src/editor/PrintProfileDialog.tsx`          | editor                       |
| `src/editor/SettingsScreen.tsx`              | sections                     |
| `src/editor/settingsScreenModel.ts`          | `print` row                  |
| `src/editor/BookSettingsSection.tsx`         | Printer PRINT                |
| `src/editor/bookHistory.ts`                  | snapshot                     |
| `src/editor/bookStore.ts`                    | customs, paint key, restore  |
| `src/editor/FilmstripItem.tsx`               | customs                      |
| `src/editor/PhotoSection.tsx`                | customs                      |
| `src/editor/projectSession.ts`               | bind store                   |
| `src/ui/Select.tsx`                          | optgroups                    |
| `src/editor/editorChromePanels.ts`           | `pagesNote` range            |
| `src/editor/editorChromeTokens.ts`           | drop unused page re-exports  |
| `src/testFixtures/loadPainterFixture.ts`     | `&px=`, `&printProfiles=kit` |
| `src/testFixtures/painterFixture.test.ts`    | unit                         |
| `styles/app.css`                             | dialog box                   |
| `src/core/printPresets.test.ts`              | refresh                      |
| `src/editor/printProfileDraft.test.ts`       | unit / PBT                   |
| `src/editor/printProfilesStore.test.ts`      | unit                         |
| `src/editor/PrintPresetsSection.test.tsx`    | unit                         |
| `src/editor/BookSettingsPrinter.test.tsx`    | unit                         |
| `src/editor/bookStore.printProfiles.test.ts` | unit                         |
| `src/editor/bookStore.history.test.ts`       | one undo step                |
| `src/editor/SettingsScreen.test.tsx`         | nav                          |
| `src/editor/settingsScreenModel.test.ts`     | nav                          |
| `e2e/printer-presets.spec.ts`                | e2e + perf gate              |
| `e2e/library-screens.spec.ts`                | nav rows                     |
| `e2e/design-r10-inspectors.spec.ts`          | PRINT +66                    |
| `e2e/design-r11-controls.spec.ts`            | PRINT +66                    |
| `docs/roadmap/P5/printer-presets.md`         | scope change                 |
| `docs/roadmap/P4/preflight-core.md`          | moved criterion              |
| `docs/roadmap/P4/pdf-export.md`              | moved criterion              |

- Unit / PBT: store, draft rules (valid round-trip PBT), `refreshPrintProfile`, pick undo (bleed clamp, safe, trim kept), `settingsScreenModel`, `SettingsScreen` (aria-current), `EditorSettings`, Book settings Printer + custom-range Pages.
- e2e `printer-presets.spec.ts`: empty, duplicate→edit→save→pick (B/S, low-res), invalid, delete keeps values, default for new books, undo; `print-profile-switch` gate (40 spreads, zero LoAF). Updated: `library-screens` (2 rows), `design-r10-inspectors` / `design-r11-controls` (+66).
