# editor-chrome-states

Tag: feature
Milestone: M2.5
Title: editor states on tokens and primitives
Status: done

## Scope

- [x] Filmstrip status, Placed badge, empty state, placeholders and import errors (Status / Toast) on primitives
- [x] Canvas chrome — pasteboard, paper, frame placeholder, selection, drop target, focus — from semantic tokens; one empty / loading / error pattern across the editor
- **Perf:** drop-target highlight still toggles one attribute; placeholders stay static (no animated gradients on the pasteboard). Gate: `drag-place-replace` and filmstrip import scenarios — zero LoAF.
- **Browser check:** empty editor, import of 100+ photos with one failing file, drag-place and swap — every state matches `docs/design.md`; empty copy readable in one flow; no page-level H/V scroll.
- **UI ref:** `uikit#/feature/editor-chrome-states`
- **UI kit:** `uikit/src/features/m25.tsx:222-230` (`editor-chrome-states` demo + notes), `UI ref: uikit#/feature/editor-chrome-states` — Empty / Importing / Import error / Drop / Placed scenarios; demo `uikit/src/features/m25.tsx:113-142`, `uikit/src/components/ui/toast.tsx`, `uikit/src/components/ui/progress.tsx`, `uikit/src/components/uui/FeaturedIcon.tsx`

## Done note

Filmstrip Status/ProgressBar/Badge/EmptyState; import-error Toast; canvas tokens; manual-qa wrapper
