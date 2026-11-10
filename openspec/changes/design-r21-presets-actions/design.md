## Decisions

1. M99: the kit row actions are `outline` (`--field` rest, `--accent` hover); prod's `secondary` hover mix beats the utility. Use `Button` `outline`.
2. M100: `AlertDialog` `icon` defaults to the trash glyph in `FeaturedIcon` (kit API); layout values (420 px, `--text-xl` title, `md` buttons) copied from kit `#/demo` into `AlertDialog.css`.
3. M101: kit `.pb-badge { box-shadow: none }` covers every tone; drop the ring from `.pb-badge`. `--badge-*-ring` tokens stay; `docs/design.md` Badges line notes it.

## Touch-set & Test Plan

| Path                                            |
| ----------------------------------------------- |
| `src/editor/PrintPresetsSection.tsx`            |
| `src/ui/AlertDialog.tsx`                        |
| `src/ui/AlertDialog.css`                        |
| `src/ui/AlertDialog.test.tsx`                   |
| `src/ui/chromeParity.test.tsx`                  |
| `src/ui/Badge.css`                              |
| `e2e/printer-presets.spec.ts`                   |
| `docs/design.md`                                |
| `docs/roadmap/P4/design-r21-presets-actions.md` |

- Reuse: `Button`, `FeaturedIcon`, `Icon`, `paintProbe` `pixelsAt`.
- Unit: default trash tile, md buttons, a passed `icon` wins.
- e2e paint: badge edge ≈ 211, actions 215 → 207 on hover, delete confirm tile / 21 px / 36 px buttons.
