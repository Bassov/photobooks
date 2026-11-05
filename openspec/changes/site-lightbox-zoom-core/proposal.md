## Proposal

Roadmap: `docs/roadmap/P5/site-lightbox-zoom-core.md` (scope / Done when / Browser / Perf SoT). Design: Designer `site-lightbox` spec §2–§4.

### Scope out

- Any UI or wiring: `SpreadPager` / `src/site/**` adopt the model in item `site-lightbox` (with its `spread-view` / `site-viewer` spec requirement).
- Gesture plumbing (double-tap timing, pinch distance, `will-change` timers, `sizes` upgrade).

### Delta / Risk

- New pure module only; no spec delta here because no visible behavior changes until `site-lightbox` lands.
