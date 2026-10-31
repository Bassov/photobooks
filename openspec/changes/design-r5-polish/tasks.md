## Implementation

- [x] 1. M43: selection and crop `::after` yield to the drop chip on a drop target; the chip takes the kit `text-2xs` line height. (`SpreadView.css`; `M43 … step 17` e2e)
- [x] 2. M44: the Library link gets the kit 6 px / 10 px padding and 4 px gap, not overridden by `.pb-button`. (`EditorShell.css`, `EditorTopBar.tsx`; `M44 …` e2e)
- [x] 3. `e2e/design-r5-polish.spec.ts` asserts the kit values; unit style test updated. (90/90 at `--repeat-each=30 --workers=4`)

## Manual test scenarios

1. 1440×900: drop a photo, click it, press and drag 60 px left: the dimmed photo stays whole, chip centred at the top; Escape + release restore it.
2. Editor top bar: "‹ Library" chevron at x 18, label at x 38.

`pnpm agent manual-qa` (2026-11-01), 1–2: problem (harness entry, not reached). The `start-session` click times out because the welcome `<header>` intercepts the pointer (`WelcomeScreen.tsx` is unchanged on this branch; r4 hit the same). Both scenarios are covered in a real browser by `e2e/design-r5-polish.spec.ts` (×30 green) and the PR evidence shots (mid-drag source, top-bar left).
