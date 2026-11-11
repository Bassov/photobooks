## Proposal

Roadmap: `docs/roadmap/P4/lightbox-timer-leak.md` (scope / Done when SoT).

### Scope out

- `uikit/`, `src/site/` personal-site files, `e2e/`, `docs/design.md`.
- Any zoom / settle behaviour change while the lightbox is mounted.

### Delta / Risk

- Audit of `src/render/`: only the `useLightboxZoom` settle timeout lacks an unmount cleanup; the keydown, wheel and matchMedia listeners and the three ResizeObservers already clean up. No rAF or interval exists there.
- No UI, no security surface, no spec delta (cleanup only).
