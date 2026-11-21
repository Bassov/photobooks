## Decisions

1. M138: delete `color: currentColor` from `.pb-icon`. An svg inherits `color` anyway; the unlayered rule only beat Tailwind `text-*` utilities on the svg. No layer move (Icon.css also loads in the site entry; a removed rule outranks nothing).
2. `.pb-menu-item[data-variant='destructive'] .pb-icon { color: var(--destructive) }` in `Menu.css` — prod twin of the kit's `[&_svg]:text-destructive!`.
3. Audit (`git grep` of `Icon` callers and `[&_svg]:text-` / svg colour classes): only the three menus' `[&_svg]:text-muted-foreground` (frame/page/parent, spread, masters) and `LibSearch` / `LibSort` icon classes were dead. Menus become `--muted-foreground` (intended). Library icons must stay unchanged (Done when): drop their dead `text-muted-foreground`.
4. M139: new `copyPlus` glyph (lucide 1.70 CopyPlus) for the frame-menu Duplicate row; `duplicate` (spread list) untouched.
5. M140: `bringToFront` = lucide 1.70 BringToFront; callers are `Z_MOVES` → frame menu and ARRANGE buttons.

## Touch-set & Test Plan

| Path                                |
| ----------------------------------- |
| `src/ui/Icon.css`                   |
| `src/ui/Menu.css`                   |
| `src/ui/icons/glyphs.ts`            |
| `src/ui/Icon.test.tsx`              |
| `src/editor/frameMenuModel.ts`      |
| `src/editor/frameMenuModel.test.ts` |
| `src/editor/LibSearch.tsx`          |
| `src/editor/LibSort.tsx`            |
| `e2e/frame-context-menu.spec.ts`    |

- Reuse: `Icon`, `MenuItem variant`, `e2e/fixtures/paintProbe.ts`; tokens `--muted-foreground`, `--destructive`.
- Unit: Duplicate row icon `copyPlus` ≠ Copy `copy`; `copyPlus` / `bringToFront` nodes equal lucide 1.70; name list 97.
- e2e: row icon ink `--muted-foreground`, Delete `--destructive` (computed + darkest painted pixel); Duplicate svg ≠ Copy svg; ARRANGE Bring to front svg colour = its button colour (non-menu icon unchanged).
