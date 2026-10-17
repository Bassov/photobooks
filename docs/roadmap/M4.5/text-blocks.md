# text-blocks

Tag: feature
Milestone: M4.5
Title: captions

## Scope

- [ ] Text frames with inline editing; built-in styles (title, caption, body)
- **Perf:** fonts preloaded before first measure; typing re-renders only the edited text frame. Gate: type 200 characters fast — INP ≤ 100 ms.
- **Browser check:** add a caption, edit it inline; it renders the same in the workspace and in spread thumbnails.
- **UI ref:** `uikit#/feature/text-blocks`
