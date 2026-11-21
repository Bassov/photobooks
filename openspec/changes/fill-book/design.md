## Decisions

1. The chip is first in the dock head's `ml-auto` group and is not gated on `onChoosePhotoFolder`.
2. Popover = `MenuPopover` (kit look: offset 4, no hairline) + `PopoverDialog` (padding 12), width 296; tokens per
   `docs/design.md` (`--popover`, `--shadow-md`, `--shadow-xs`). Warning icon = existing `warning` glyph; new glyph
   `bookImage`. Skill `ui-review` before push.
3. First changed spread = the first new-book spread whose object is not `===` the old one (core keeps untouched spreads);
   no core change. Reveal through `revealFrames` (scroll only when < 50 % shows, zoom kept).
4. `fillBookStatus` is a pill status (`isStatusPillVisible` regex), as in the kit StatusLine.

## Touch-set & Test Plan

| File                                                 | Why                                             |
| ---------------------------------------------------- | ----------------------------------------------- |
| `src/editor/FillBookButton.tsx`                      | new chip + popover + confirm                    |
| `src/editor/FillBookButton.test.tsx`                 | reasons, rows, confirm / cancel                 |
| `src/editor/FilmstripDock.tsx`                       | render chip first                               |
| `src/editor/FilmstripDock.test.tsx`                  | chip present, stays without Add folder          |
| `src/editor/editorStatus.ts`                         | `fillBookStatus`, pill regex                    |
| `src/editor/editorStatus.test.ts`                    | status text + pill                              |
| `src/editor/editorChromeTokens.ts`                   | chip CSS                                        |
| `src/ui/icons/glyphs.ts`                             | `bookImage`                                     |
| `src/ui/Icon.test.tsx`                               | glyph count pin                                 |
| `src/editor/editorChromeTokens.test.ts`              | chip CSS pin                                    |
| `src/editor/bookHistory.ts`                          | label `fillBook: 'Fill book'` (FB2 left it out) |
| `src/editor/bookHistory.test.ts`                     | label pin                                       |
| `e2e/fill-book.spec.ts`                              | prod flow                                       |
| `e2e/kit10-filmstrip.spec.ts`                        | `film-fill-book` pin                            |
| `openspec/changes/fill-book/specs/filmstrip/spec.md` | requirement                                     |

- Reuse: core `planFillBook` / `fillBook`, `revealFrames`, `flashEditorStatus`, `MenuPopover`, `PopoverDialog`, `Button`.
- Tests: unit + e2e per tasks.md.
