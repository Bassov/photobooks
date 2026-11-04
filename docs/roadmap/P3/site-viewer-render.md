# site-viewer-render

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item site-viewer-render
Status: done

Render refactor for the site viewer (Designer design site-viewer, Item 2 of 3; spec §6, §8). No visible change: editor, Preview and library look exactly as before.

## Scope

- [ ] Move `src/editor/BookObject.tsx` + `bookObjectLayout.ts` (and their tests) to `src/render/`; update every caller (no re-export shims).
- [ ] `pageLabel` moves to `src/core/pages.ts`.
- [ ] `src/render/SpreadView.tsx`: optional `imageFor` prop (srcset source per image); default = today's behaviour.
- [ ] Extract a pure `src/render/CoverView.tsx` from `src/editor/CoverCanvas.tsx`; Preview renders the cover through CoverView.
- **Browser check:** editor cover canvas, spread-list cover row, Preview cover slide and library tiles look unchanged (existing visual baselines, no re-baseline).

## Done when

- [ ] All unit/e2e green with no snapshot/visual baseline changes for editor, Preview, library (PR names the checks).
- [ ] `imageFor` covered by a unit test (srcset attribute rendered; absent prop = unchanged DOM).
- [ ] PR body lists every caller of moved modules as updated.

Off limits: `uikit/`, `src/site/` and export code, `src/core/parentSpreads.ts` / `resolveSpread.ts`.
