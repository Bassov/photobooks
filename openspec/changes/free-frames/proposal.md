## Proposal

Roadmap: `docs/roadmap/M4/free-frames.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/free-frames`.

### Scope out

- No snap-to-grid wiring (`layout-grids-snap-wire`), no rulers / guides UI, no Text tool, no multi-select / marquee / arrange / rotate handle, no floating frame toolbar.
- Filled frames are not pointer-moved (their drag is the photo swap); resize handles stay visual.

### Delta / Risk

- UI: empty = Frame tool on bare paper draws; happy = ≥ 5 mm drag selects the new frame and returns to Select; interact = Delete removes, empty frame drag-moves with snap lines. No page-level scroll change.
- Empty frames become selectable (Phase A made only filled ones selectable); Delete on a filled focused frame still unplaces.
