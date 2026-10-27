## Proposal

Roadmap: `docs/roadmap/M3/spread-list-panel.md` (scope / Browser / Perf SoT). UI ref: `uikit#/feature/spread-list-panel`.

### Scope out

- Drag-resize of the panel and reorder (`ui-panels`, `spread-reorder-retemplate`).
- Page masters; inspector.

### Delta / Risk

- Panel thumbnails are real `SpreadView`s (thumb tier, windowed); `duplicateSpread` op; per-item menu add-after / duplicate / delete (Undo toast).
- E2E locks: list shows N spreads (happy), last spread not deletable (edge), click scrolls pasteboard; scrolling only inside `spreads-list` and `pasteboard` — no page-level H/V scroll.
- No security surface.
