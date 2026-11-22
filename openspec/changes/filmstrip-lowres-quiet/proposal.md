## Proposal

Roadmap: `docs/roadmap/P5/filmstrip-lowres-quiet.md` (scope / Done when / Browser SoT). Designer P11, Owner Q-21.

### Scope out

- Photo inspector (P12 shipped as inspector-rotate-row); palette tokens (P10, #713); canvas dpi badge.
- `uikit/scripts/qa.mjs` (frozen): kit checks go to `e2e/kit-filmstrip-lowres.spec.ts`.

### Delta / Risk

- Observables: happy = chip 18 × 16.84 icon-only at default and max thumb size, header ends "· 1 low-res" in warning ink; empty = no "low-res" in the header when no shown photo is flagged; interact = Unplaced filter and placing a photo change N, resize keeps the chip size.
- Header count runs the chip predicate over the shown strip on store changes: memoized on the inputs it reads so frame edits do not recount (60 fps).
