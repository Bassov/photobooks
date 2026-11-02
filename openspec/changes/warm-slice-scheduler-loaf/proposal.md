## Proposal

Roadmap: `docs/roadmap/P2/warm-slice-scheduler-loaf.md`.

### Scope out

- Warm lane / hydrate slicing (slices already ≤ 6 ms).
- PERF_BUDGETS, fling gates, thumb lane files of `filmstrip-stuck-thumbs`.
- Filmstrip look, scrollport and window maths.

### Delta / Risk

- The filmstrip swaps react-aria `GridList` for an in-house grid. Risk: keyboard / a11y parity, covered by unit + filmstrip e2e.
- Observables: empty unchanged, click-select works, fling at 0 LoAF.
