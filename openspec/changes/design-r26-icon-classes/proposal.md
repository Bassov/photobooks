## Proposal

Roadmap: `docs/roadmap/P3/design-r26-icon-classes.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Moving `src/ui/Icon.css` into a Tailwind layer (would recolour / resize other icons that earlier parity rounds passed).
- Kit (`uikit/**`) changes.

### Delta / Risk

- UI: e2e locks the happy path (Settings open, 4 nav icon pixels muted; Hosting R2 link icon 12×12); no empty state or scrollport involved.
- New icon size 12 is additive; existing 14/16/20 users are unchanged.
