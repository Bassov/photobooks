## Proposal

Roadmap: [`docs/roadmap/P2/multi-select-marquee.md`](../../../docs/roadmap/P2/multi-select-marquee.md) (scope / Done when / Browser / Perf SoT); UI ref `uikit#/feature/frame-selection-handles`.

### Scope out

- Inspector multi context, Align & distribute, Arrange set (`multi-select-inspector`).
- Kit "Three frames, one locked" page variant; marquee on cover / endpapers.

### Delta / Risk

- Click < 3 px unchanged; the marquee keeps the previous selection for Shift-union and Esc.
- e2e: click → no marquee; pasteboard marquee counts; Shift-union, Esc, Hand pan. Box clipped to the scrollport, no page scroll.
