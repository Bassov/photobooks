## Decisions

Geometry, layer order and colours: roadmap item + Designer Spec "Geometry" / "Layers" (not restated).

1. **`CoverSpread big` root = the sheet** (`cover-sheet`); the closed cover is an absolutely placed child (a `container-type: inline-size` box for cqw texts). Mini / slide covers keep the closed cover as root with no overlays.
2. **Front photo = child layer `.cover-front-photo`** overflowing into the wrap; `cover-front` is `overflow: hidden` only in mini mode, so every cover shares one crop.
3. **Chip visibility:** `useLayoutEffect` + `ResizeObserver` on the sheet; no first-paint flicker.
4. **Camera:** `fitScale` gains a height argument; the cover fits the sheet box.
5. **Labels:** `padding-inline` = wrap fraction of the sheet, so the Back / Spine / Front fractions stay of the closed cover, 10 px under the sheet.
6. **Tokens / primitives** (`docs/design.md`): `--cover-shadow` (kit `shadowBig`), `--canvas` veil, `--foreground` chip (`T`), `--text-2xs`; inspector `Head` / `Sec` / `Row`; Book settings `SegC` size editor.

## Touch-set & Test Plan

| File                                    | Why                                                              |
| --------------------------------------- | ---------------------------------------------------------------- |
| `uikit/src/sandbox/v7.tsx`              | geometry, layer stack, spine text, inspector                     |
| `uikit/src/sandbox/viewport.tsx`        | camera, labels, drop                                             |
| `uikit/src/sandbox/chrome.tsx`          | `coverW` pages                                                   |
| `uikit/src/demo-parts/site.tsx`         | `coverW` pages                                                   |
| `uikit/src/demo-parts/presentation.tsx` | `coverW` pages                                                   |
| `uikit/src/features/site-viewer.tsx`    | `coverW` pages                                                   |
| `uikit/src/features/pages.tsx`          | "120 pages" state, notes                                         |
| `uikit/scripts/qa.mjs`                  | cover-editor checks; existing cover checks follow the new layers |
| `docs/roadmap/P4/cover-editor-kit.md`   | item scope                                                       |

- Tests: kit `qa:quick` — empty ("New cover": no photo layer, overlays present), happy ("Photo + title" sizes, chip, inspector texts), interact ("120 pages" spine, long spine text, A3 landscape chip). Skill `ui-review` before push.
