## Proposal

Roadmap: `docs/roadmap/P2/kit-sync-canvas.md` (scope / Done when SoT). UI ref: `uikit#/demo`.

### Scope out

- `src/`; the other kit-sync lanes.
- Rulers, cover / endpaper / master / last page keep the single-spread camera.

### Delta / Risk

- UI observables: empty = idle gap, no pill; happy = stacked spreads, 11 px numbers; interact = filmstrip drag shows the pill, gap does not grow; Esc leaves no chip. Scrolling only inside the pasteboard; no page-level H/V scroll.
