# filmstrip-lowres-quiet

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item filmstrip-lowres-quiet
Status: done

## Scope

P11 "Filmstrip status without noise" (Designer walkthrough-polish-review, Owner Q-21). Kit + prod in one PR.

- [ ] Low-res chip is always the compact icon-only variant (18 × 16.84, 10 px icon, no visible "Low-res" text, `title` and `aria-label` "Low-res", left+4 / top+4, `--warning-ink`) at every thumb width; the `< 73.33px` container switch is gone. Kit `uikit/src/sandbox/chrome.tsx` and prod `src/editor/FilmstripItem.tsx` + `src/editor/Filmstrip.css`.
- [ ] Photos header adds " · N low-res" in `--warning-ink` when N > 0 (nothing when N = 0), after "· M used", in the filtered and unfiltered forms; N uses the same predicate as the chip. Prod `src/editor/FilmstripDock.tsx`; kit `film-head`.
- [ ] Pins updated, not loosened: design-r16-prod, printer-presets, polish-icons-chrome, kit-tokens, design-filmstrip-fixed, Filmstrip/FilmstripDock unit tests.
- **Browser check:** prod 1440×900 with a low-res photo: chip box 18 × 16.84 at default and max filmstrip size, no "Low-res" text painted, header ends "· 1 low-res" in warning ink; no "low-res" without low-res photos. Kit `#/demo` editor step the same.
