## Decisions

1. Shape filter in `LayoutPicker`: `saved = mine.filter(t => t.pages === getSpreadPageCount(…))` drives counts and tiles; thumbnails stay on the current trim (`customLayoutRects`); header note via `templateName(selected, pages)`; Save passes `pages`.
2. Dedup: `findSameSavedTemplate(pages, slots)` in `savedTemplates.ts`. A hit adds nothing, opens My templates / Any and sets a fresh `flash` object, so the 1200 ms effect timer restarts; the effect scrolls the tile cell into view.
3. Flash = `--shadow-tile-hover` + 1 px lift on the paper (`--select` ring when pressed); reduced motion drops the transform.
4. Announcements go through `setEditorStatus`; the store reports a failed or thrown library write.
5. Kit mirrors prod: custom templates bypass `onPage` / `pageFrames` and store page percents on page 1.
6. `ui-review` runs on the prod picker and the kit before push.

## Touch-set & Test Plan

| Path                                       | Why                            |
| ------------------------------------------ | ------------------------------ |
| `src/editor/LayoutSection.tsx`             | filter, dedup, flash, statuses |
| `src/editor/LayoutSection.css`             | flash                          |
| `src/editor/LayoutSection.picker.test.tsx` | page empty copy                |
| `styles/tokens.css`                        | `--shadow-tile-flash-select`   |
| `uikit/src/index.css`                      | same token (kit)               |
| `docs/design.md`                           | flash token                    |
| `src/editor/savedTemplates.ts`             | dedup, write failure           |
| `src/editor/LayoutSection.saved.test.tsx`  | unit                           |
| `src/editor/savedTemplates.test.ts`        | unit                           |
| `e2e/design-r2-layout-picker.spec.ts`      | e2e                            |
| `uikit/src/data.ts`                        | `pages?`                       |
| `uikit/src/sandbox/templates.ts`           | kit store                      |
| `uikit/src/sandbox/context-inspector.tsx`  | kit picker                     |
| `uikit/scripts/demo-capture.mjs`           | demo step                      |
| `uikit/scripts/qa.mjs`                     | kit probes                     |

Reuse: `getSpreadPageCount`, `templateName`, `customLayoutRects`, `--shadow-tile-hover`. Tests: RTL with fake timers, e2e per roadmap, kit qa.
