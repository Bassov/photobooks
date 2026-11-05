## Decisions

1. The kit never imports `src/`: new `printProfiles.tsx` holds `KitProfile` (the D2 subset of core `PrintProfile`) and a sample catalog; Generic copies `genericPrintProfile()`, shop numbers are sample data (D8).
2. State lives in the kit session: `SessionState.printProfiles` (customs) + `defaultPrintProfileId`; deleting the default falls back to Generic. Optional `DBook.printProfile` (absent = Generic, the only case seeded until item 2b) feeds PrintDialog.
3. A pure `profileIssues(draft)` returns the spec messages per field; Save is disabled while any exist.
4. Number fields are plain `inputMode="decimal"` inputs, not RAC NumberField: invalid raw values (empty, 121) must stay visible.
5. The default select is a native `<select>` with optgroups, like prod.
6. Scenarios are seeded through `RootInit.settings.print` (editor open on a profile / invalid draft) and the session (`print-empty`).

## Touch-set & Test Plan

| Path                                     | Why                                     |
| ---------------------------------------- | --------------------------------------- |
| `uikit/src/demo-parts/printProfiles.tsx` | new: catalog, model, issues, dialog     |
| `uikit/src/demo-parts/settings.tsx`      | Print presets section                   |
| `uikit/src/demo-parts/session.tsx`       | customs + default; `DBook.printProfile` |
| `uikit/src/demo-parts/root.tsx`          | `settings.print` scenario seed          |
| `uikit/src/demo-parts/dialogs.tsx`       | PrintDialog Printer row + bleed         |
| `uikit/src/demo-parts/editor.tsx`        | pass the book's profile to PrintDialog  |
| `uikit/src/features/pages.tsx`           | site-settings print scenarios + `what`  |
| `uikit/scripts/qa.mjs`                   | printer-presets-kit asserts             |
| `docs/roadmap/P5/printer-presets-kit.md` | item filled from the brief              |

- Reuse: kit `AppModal`, `AlertDialog`, `Button`, `IconButton`, `Menu*`, `Badge`.
- Tests: kit qa block (DOM measured at 1440 × 900). Kit only: no prod unit / Playwright e2e; `ui-review` applies to the kit screens.
