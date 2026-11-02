## Proposal

Roadmap: `docs/roadmap/P2/filmstrip-stuck-thumbs.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Leave-now cancel model, lanes, warm lane, hydrate slicing (`warm-slice-scheduler-loaf`).
- Import error reporting for a failed retry decode.

### Delta / Risk

- Scrollport: no page-level H/V scroll; scrolling only inside `filmstrip-scroll`.
- Risk: a retry for an asset already in now runs at once (one extra decode at most).
