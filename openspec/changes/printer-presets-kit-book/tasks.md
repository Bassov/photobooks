## Implementation

- [ ] 1. `Doc.print` + `printSafe`; folios (v7 / canvas / chrome) read it.
- [ ] 2. `printProfiles.tsx`: `profileHint`, `printIssues`, `pagesRange`, `PrintCustomsCtx`.
- [ ] 3. `BookInspector` PRINT: Printer select (one undo step, live region), hint, warnings, B/S `mt-3` from the doc; Pages range from the profile.
- [ ] 4. `DemoEditor`: provide session customs; PrintDialog uses the doc's profile.
- [ ] 5. `features/pages.tsx` `inspector` scenario `book-lulu` + `what` text.
- [ ] 6. Kit qa asserts (positions, warnings, pick + undo).

## Manual test scenarios

1. Kit `#/feature/inspector` → Book settings: Printer = Generic, hint "5–50 cm · 20–120 pages · photos ≥ 200 ppi", no warnings, B 3 / S 8.
2. Pick Lulu · Photo book → B 3.175, S 12.7, "prints at least 24 pages" warning; Ctrl+Z → Generic, B 3, S 8.
3. Scenario "Lulu picked" → two warnings (page width, page count).
