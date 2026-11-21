# design-r35-filmstrip-wheel-kit

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r35-filmstrip-wheel-kit
Status: done

Designer parity walkthrough-ux-review p3 Must M137 (Round 35) and the tracker p3 "Decided" focus cue. Kit-only.

## Scope

- [x] M137: a vertical mouse wheel over the kit filmstrip scrolls it sideways (Owner Must M50), as prod `installFilmstripWheel` (`src/editor/filmstripWheel.ts`): passive listener, line / page delta modes, `overscroll-behavior: contain`; the canvas zoom does not change. Copied into the kit (the kit imports no prod code).
- [x] Kit filmstrip thumb shows prod's focus cue `0 0 0 2px #535152` (rgb 83 81 82) when it is selected and focused (keyboard focus and after a click), as prod `.filmstrip-item[aria-selected=true][data-focused]`; a named kit shadow token, no `shadow-[…]` literal.
- [x] `e2e/design-r7-panels.spec.ts` M50 note that the kit leaves the wheel to the browser is removed; e2e asserts the kit wheel and the focus ring paint.
- **Browser check:** kit `#/demo`: wheel deltaY 300 over the strip → scrollLeft 300 (±1), zoom label still "Fit"; click a thumb → 2 px #535152 ring pixels around it.

## Done when

- Kit: wheel deltaY 300 over the strip → scrollLeft 300 (±1), zoom label still Fit (e2e).
- Kit: focused thumb shows the 2 px rgb(83,81,82) ring (paint check), same as prod.
- `e2e/design-r7-panels.spec.ts` M50 note removed; kit-\* specs green locally.
