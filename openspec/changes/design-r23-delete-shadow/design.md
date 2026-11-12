## Decisions

1. Put `box-shadow: var(--shadow-xs)` on the base `.pb-button--destructive` rule, so hover keeps it without repeating it. Add `.pb-button--destructive[data-pressed] { box-shadow: none }` before the shared `[data-focus-visible]` rule, so a keyboard focus ring still wins (kit: `ring` on focus-visible). Disabled/pending already set `none`.
2. No new token: `--shadow-xs` is already used by `.pb-button--secondary`. Rendered value = kit `0 1px 2px 0 rgb(20 20 19 / .06)`.
3. Destructive Button uses (all through `AlertDialog` with the default `tone`, so they all share the class): Print presets Delete profile (`PrintPresetsSection`), Library Remove book (`LibraryScreen`), Filmstrip Remove placed photo (`FilmstripDock`), `SpecimenPage` demo. Neutral-tone dialogs (Library trash, Settings) use `default` and stay unchanged. `MenuItem variant="destructive"` is another component, so it is out of scope.

## Touch-set & Test Plan

| File                          | Why                                             |
| ----------------------------- | ----------------------------------------------- |
| `src/ui/Button.css`           | destructive shadow at rest / none while pressed |
| `e2e/printer-presets.spec.ts` | M100 test: computed + paint lock-in             |

- Reuse: `e2e/fixtures/paintProbe.ts` `pixelsAt`.
- e2e (existing M100 test, Delete-profile confirm): Delete computed `box-shadow` = `rgba(20, 20, 19, 0.06) 0px 1px 2px 0px` at rest and on hover, `none` while the mouse is held down; Cancel (ghost) stays `none`. Paint: the 1 px row under Delete is darker than the dialog background 6 px lower.
- No unit test: jsdom does not apply CSS files.
