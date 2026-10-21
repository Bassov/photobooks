# project-screens-adoption

Tag: feature
Milestone: M2.5
Title: M2 screens on the design system
Status: done

## Scope

- [x] Home screen, permission re-grant and "open in another tab" messages, save indicator and missing-assets view rebuilt from `src/ui` primitives (Dialog, EmptyState, Status, Badge)
- **Perf:** home screen book list stays virtualized-or-small; save indicator is a narrow subscription. Gate: drag while autosave fires — zero LoAF.
- **Browser check:** reopen the app, open a book, trigger a permission re-grant and a second-tab lock, rename a photo folder — every screen matches `docs/design.md`; no page-level H/V scroll.
- **UI ref:** `uikit#/feature/project-screens-adoption`
- **UI kit:** `uikit/src/features/m25.tsx:231-239` (`project-screens-adoption` demo + notes), `UI ref: uikit#/feature/project-screens-adoption` — Home / empty / permission / lock / missing / save scenarios; demo `uikit/src/features/m25.tsx:147-158`, `uikit/src/features/screens.tsx`, `uikit/src/components/ui/dialog.tsx`, `uikit/src/components/uui/Badge.tsx`

## Done note

Home/permission/lock/save/relink on src/ui primitives; HomeScreen Stryker bang-exclude removed
