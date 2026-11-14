## Decisions

1. Nav icon colour: wrap the Settings nav `<Icon>` in a `<span className="inline-flex text-muted-foreground">`. The svg's `color: currentColor` inherits the span's muted colour, so the unlayered `Icon.css` rule no longer fights the utility. Label text keeps the button colour.
2. Link icon size: add `12` to `ICON_SIZES`, `--icon-size-12: 12px` in `styles/tokens.css`, and `.pb-icon[data-size='12']` in `Icon.css`; the R2 tokens link passes `size={12}` (drop the dead `size-3`). `docs/design.md` lists 12 among the size tokens.
3. `Icon.css` stays unlayered: other icons with colour/size classes (LibSearch, LibSort, FilmstripDock, …) keep today's computed values; the PR lists each.

## Touch-set & Test Plan

| Path                                  | Why                               |
| ------------------------------------- | --------------------------------- |
| `src/editor/SettingsScreen.tsx`       | muted span around nav icon        |
| `src/editor/HostingSection.tsx`       | R2 link icon `size={12}`          |
| `src/ui/icons/glyphs.ts`              | `ICON_SIZES` gains 12             |
| `src/ui/Icon.css`                     | `data-size='12'` rule             |
| `styles/tokens.css`                   | `--icon-size-12`                  |
| `docs/design.md`                      | size token list                   |
| `src/ui/Icon.test.tsx`                | size 12 via `it.each(ICON_SIZES)` |
| `e2e/design-r26-icon-classes.spec.ts` | paint + box checks                |

- Reuse: `e2e/fixtures/paintProbe.ts` `pixelsAt`, Settings open via `editor-settings-open`.
- e2e: clipped screenshot of each nav icon: darkest stroke pixel ≈ rgb(83,81,82) ±2; R2 tokens link icon bounding box 12×12.
