# recents-home-quality

Tag: feature
Milestone: M2.2
Title: home polish after correctness (what M2.1 does not cover)

## Scope

- [ ] A11y behaviour automated checks do not catch: selected-library announcement; busy keeps focus on the active control
- [ ] A11y basics (from main's `recents-home-quality`): home `h1`, visible focus ring, no redundant aria on headings (automated ARIA coverage lives in `docs/backlog/axe-e2e.md` until re-added)
- [ ] `HomeScreen.test.tsx` (empty / list / error / permission / busy / keyboard); reserved-key mutation tests; Codecov HomeScreen patch target (from main's `recents-home-quality`)
- [ ] Restore empty-editor asserts in `open-save.spec`
- [ ] IndexedDB blocked and failure paths return typed results without throw (unit tests on the `session-idb-locks-mutation` fakes)
- [ ] IDB-blocked e2e (from main's `recents-home-quality`)
- [ ] Recents dedup across separate handle objects (`isSameEntry`); recents read-modify-write in one transaction or behind `navigator.locks`; delete evicted handle keys
- [ ] Re-grant polish: pass the target book into bind; `isSameEntry` check or refusal on the peek-failed picker path
- [ ] Readable messages in the editor status line (no raw codes like `permission-required`); distinguish “Don’t Allow” from picker cancelled
- [ ] Remove runtime `window.__photobooksE2e` test-API switch
- Covered elsewhere (from main's `recents-home-quality`): LHCI on the editor surface → `docs/backlog/lhci-key-surfaces.md`; IDB v1→v2 migration test (fake-indexeddb) → `session-idb-locks-mutation`; permission denied during open → `docs/backlog/fsa-permission-e2e.md`
- **Perf:** no new interaction; existing gates stay green.
- **Browser check:** keyboard-only home; narrow ~900px; deny access, cancel the picker and reopen a recent library — each shows a readable message and focus stays on the control. Lighthouse still budgets the editor path.
- **UI kit:** `uikit/src/features/m2.tsx:243-251` (`recents-home`, `UI ref: uikit#/feature/recents-home` — recent libraries + book grid), `uikit/src/features/m25.tsx:147-158` and `:231-237` (`project-screens-adoption`, `UI ref: uikit#/feature/project-screens-adoption` — Home / empty / permission / lock scenarios), `uikit/src/features/screens.tsx` (HomeScreen). a11y/focus polish follows these home screens
