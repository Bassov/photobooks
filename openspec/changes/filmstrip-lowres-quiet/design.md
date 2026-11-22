## Decisions

1. One predicate: `isAssetLowRes` moves from `FilmstripItem.tsx` into `src/editor/pageFillLowRes.ts`; the chip and the new `countLowResAssets(ids)` share it (thresholds computed once per count).
2. `countLowResAssets` caches by reference on `ids`, `book.assets`, `book.settings.trim`, `book.printProfile`, `sessionMeta` and the print profiles (the store is immutable), so a frame move or other book edit returns the cached N.
3. Chip: the label span and the `@container (width < 73.33px)` rule go; the chip keeps its 2xs line box through `height: calc(1lh + 2px)` (border-box), so it stays 18 × 16.84 with no text node. Kit: the same Tailwind classes (`h-[calc(1lh+2px)]`), the `w < 73.33` switch removed.
4. Header: a sibling `lowres-count` span after `placed-count` (whose text stays as is) with `text-[var(--warning-ink)]`, rendered only when N > 0; N counts the shown strip (unplaced only when filtered). Kit: same span, `isLowRes(id)` = the demo `lowres` flag shared by chip and head.
5. Spec delta: MODIFIED "Low-res chip on filmstrip thumbnails" (always icon-only; header count).

## Touch-set & Test Plan

| Path                                      | Why                                                  |
| ----------------------------------------- | ---------------------------------------------------- |
| `src/editor/pageFillLowRes.ts`            | shared predicate + memoized count                    |
| `src/editor/FilmstripItem.tsx`            | icon-only chip, shared predicate                     |
| `src/editor/Filmstrip.css`                | drop container switch, fixed height                  |
| `src/editor/FilmstripDock.tsx`            | header " · N low-res"                                |
| `uikit/src/sandbox/chrome.tsx`            | kit chip + film-head                                 |
| `src/editor/Filmstrip.test.tsx`           | chip has no text                                     |
| `src/editor/FilmstripSortFilter.test.tsx` | header count: none / unfiltered / filtered / recount |
| `e2e/design-r16-prod.spec.ts`             | prod 18 × 16.84 default + max, paint, header, N = 0  |
| `e2e/kit-filmstrip-lowres.spec.ts`        | kit twin                                             |
| `e2e/printer-presets.spec.ts`             | chip by accessible name                              |
| `e2e/design-filmstrip-fixed.spec.ts`      | thumbs carry no text at all                          |
| `openspec/specs/filmstrip/spec.md`        | via delta                                            |
