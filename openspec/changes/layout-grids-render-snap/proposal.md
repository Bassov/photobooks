## Proposal

Roadmap: `docs/roadmap/M4/layout-grids-render-snap.md`; UI ref `uikit#/feature/layout-grids-render-snap`.

### Scope out

- No frame move/resize gesture, handles, snapping-engine, rulers, guides, Frame tool: none exist yet. This slice ships the pure grid-snap module and its label; wiring into the gesture is the roadmap follow-up `layout-grids-snap-wire`.
- No multi-select / arrange; no floating toolbar.

### Delta / Risk

- Overlay restyle (dashed 1.5px `--grid-line`, column fill), TopBar "Layout grid" toggle + Ctrl+', snap on/off (Shift+S), pure `gridSnap`. Observables: grid hidden → no overlay; shown → margins + C×R bands; toggle pressed state gray.
- No scrollport change; no security surface.
