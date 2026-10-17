# project-screens-adoption

Tag: feature
Milestone: M2.5
Title: M2 screens on the design system

## Scope

- [ ] Home screen, permission re-grant and "open in another tab" messages, save indicator and missing-assets view rebuilt from `src/ui` primitives (Dialog, EmptyState, Status, Badge)
- **Perf:** home screen book list stays virtualized-or-small; save indicator is a narrow subscription. Gate: drag while autosave fires — zero LoAF.
- **Browser check:** reopen the app, open a book, trigger a permission re-grant and a second-tab lock, rename a photo folder — every screen matches `docs/design.md`; no page-level H/V scroll.
- **UI ref:** `uikit#/feature/project-screens-adoption`
