## Proposal

Roadmap: [`docs/roadmap/P4/site-final-painter.md`](../../../docs/roadmap/P4/site-final-painter.md) (scope / Done when SoT; Designer D39 / P1).

### Scope out

- No consumer: `site-final-gl` wires faces, grain, lazy painting.
- No edits outside `src/render/pagePainter*` and `e2e/page-painter.spec.ts`.
- Editor chrome (fold, placeholders, badges) and the cover.

### Delta / Risk

- No spec delta (`skip_specs`); parity locked by e2e.
- Canvas vs DOM text layout, locked by the line-box e2e check.
