## Decisions

1. One predicate: `isAssetLowRes` moves into `src/editor/pageFillLowRes.ts`; the chip and `countLowResAssets(ids)` share it.
2. The count is memoized on the immutable store inputs it reads.
3. Chip: no label span, no `< 73.33px` container switch; a fixed `1lh + 2px` height keeps 18 × 16.84. Tokens `--warning-ink` (ink), `--field` (fill), `--radius-xs`; the kit chip is the reference.
4. Header: a `lowres-count` span after `placed-count` in `--warning-ink`, only when N > 0; N counts the shown strip. Kit: same span; `isLowRes(id)` shared by chip and head.
5. Spec delta: MODIFIED "Low-res chip on filmstrip thumbnails".

## Touch-set & Test Plan

| Path                                                              | Why                      |
| ----------------------------------------------------------------- | ------------------------ |
| `src/editor/pageFillLowRes.ts`                                    | predicate + count        |
| `src/editor/FilmstripItem.tsx`                                    | icon-only chip           |
| `src/editor/Filmstrip.css`                                        | chip height              |
| `src/editor/FilmstripDock.tsx`                                    | header count             |
| `uikit/src/sandbox/chrome.tsx`                                    | kit chip + head          |
| `src/editor/Filmstrip.test.tsx`                                   | no chip text             |
| `src/editor/FilmstripSortFilter.test.tsx`                         | header count             |
| `e2e/design-r16-prod.spec.ts`                                     | prod size, paint, header |
| `e2e/kit-filmstrip-lowres.spec.ts`                                | kit twin                 |
| `e2e/printer-presets.spec.ts`                                     | chip by name             |
| `e2e/design-filmstrip-fixed.spec.ts`                              | no thumb text            |
| `src/editor/pageFillLowRes.count.test.ts`                         | count memo               |
| `e2e/kit-filmstrip.spec.ts`                                       | kit label pin            |
| `e2e/kit-demo-sandbox.spec.ts`                                    | kit label pin            |
| `openspec/changes/filmstrip-lowres-quiet/specs/filmstrip/spec.md` | delta                    |
