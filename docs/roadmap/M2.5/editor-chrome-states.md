# editor-chrome-states

Tag: feature
Milestone: M2.5
Title: editor states on tokens and primitives

## Scope

- [ ] Filmstrip status, Placed badge, empty state, placeholders and import errors (Status / Toast) on primitives
- [ ] Canvas chrome — pasteboard, paper, frame placeholder, selection, drop target, focus — from semantic tokens; one empty / loading / error pattern across the editor
- **Perf:** drop-target highlight still toggles one attribute; placeholders stay static (no animated gradients on the pasteboard). Gate: `drag-place-replace` and filmstrip import scenarios — zero LoAF.
- **Browser check:** empty editor, import of 100+ photos with one failing file, drag-place and swap — every state matches `docs/design.md`; empty copy readable in one flow; no page-level H/V scroll.
- **UI ref:** `uikit#/feature/editor-chrome-states`
