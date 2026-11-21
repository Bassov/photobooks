## Proposal

Roadmap: `docs/roadmap/P5/design-r43-badge-jump-prod.md` (scope / Done when / Browser SoT). UI ref: Designer `placed-badge/spec.md` PB3, B4 (M145).

### Scope out

- Kit (already passes, M146); other spread reveals unchanged; no spec delta.

### Delta / Risk

- Risk: the post-paint check judges the frame, not the spread, for jumps only. No page scroll; scrolling only inside `pasteboard-scroll`.
