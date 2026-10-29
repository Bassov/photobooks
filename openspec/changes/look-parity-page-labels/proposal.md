## Proposal

Roadmap: `docs/roadmap/M4/look-parity-page-labels.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- No new drop logic, targets or hit-testing; no cover / endpaper / last-page / master labels.
- No spread-level drop outline: the app has no spread-paper drop target with `data-drop-hover`.

### Delta / Risk

- Visual only (CSS + `page-labels` element + `data-drop-label`); no spec delta. Observables e2e locks in: `page-labels` numbers (empty, `1`, `2`/`3`), `pasteboard-gap` opacity 1 during an asset drag, hovered frame `data-drop-hover` + `data-drop-label`. No scrollport change; no page-level scroll.
- Labels sit in the slot bottom padding (stride unchanged) and hide below zoom 0.85 and during an asset drag (the gap pill shares that band).
