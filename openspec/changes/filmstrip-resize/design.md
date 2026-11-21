## Decisions

1. H lives in a module store + `useSyncExternalStore` hook in `filmstripSize.ts` (kit `store.tsx` formulas reused, kit not edited); window resize re-renders, never writes.
2. The virtual window re-lays out on every 4 px drag step (supersedes the never-shipped "CSS-only during drag" rule; CSS-only leaves holes when slots widen).
3. Filename strip = CSS `::after { content: attr(aria-label) }` on rows when H ≥ 90, so `FilmstripItem*` stays untouched; the row grows by the strip so the image keeps H.
4. Empty row = H (empty dock 132 px at 900 high, as the kit). Look in plain CSS with existing tokens; the pill's raw `rgb(0 0 0/.24)` sits with the kit raw chrome colours in `editorChromeTokens.ts`.
5. `EditorFrame`'s bottom panel clips only to collapse: while open it overflows (CSS in `Filmstrip.css`), else the separator's upper 5 px and the chip are clipped.

## Touch-set & Test Plan

| File                                      | Why                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `src/editor/filmstripSize.ts`             | H maths, storage, store + hook                                      |
| `src/editor/filmstripSize.test.ts`        | auto 900/1080/1440/2160, clamp, steps, storage, resize no-write     |
| `src/editor/FilmstripDock.tsx`            | separator + CSS vars                                                |
| `src/editor/FilmstripDock.test.tsx`       | aria, keys, drag, double-click                                      |
| `src/editor/FilmstripResizeDrop.test.tsx` | drop "no separator" pin                                             |
| `src/editor/Filmstrip.tsx`                | virtualisation fed with H, names flag                               |
| `src/editor/Filmstrip.test.tsx`           | `--film-slot-h` follows H                                           |
| `src/editor/Filmstrip.grid.test.tsx`      | constant import → `thumbPx`                                         |
| `src/editor/FilmstripSortFilter.test.tsx` | constant import → `thumbPx`                                         |
| `src/editor/Filmstrip.css`                | separator / pill / chip / name strip                                |
| `src/editor/editorChromeTokens.ts`        | pill fill (raw kit colour)                                          |
| `e2e/filmstrip-resize.spec.ts`            | new: drag + chip paint, keys, reload, names, virtualisation, styles |
| `e2e/design-filmstrip-fixed.spec.ts`      | rewrite: separator exists, old key ignored, names ≥ 90              |
| `e2e/design-r3-chrome.spec.ts`            | empty dock 160 → 132                                                |
| `e2e/a5-fit-parity.spec.ts`               | empty dock 132 → port 720 / 738, width-limited Fit                  |
| `uikit/scripts/demo-capture.mjs`          | step `editor-filmstrip-resized` (H 128)                             |

Reuse: e2e `openSessionEditor` / `choosePhotoFolder` fixtures.
