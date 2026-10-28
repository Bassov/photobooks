## Proposal

Roadmap: `docs/roadmap/M4/frame-selection-handles.md` (scope / Musts / Perf SoT). UI ref: `uikit#/feature/frame-selection-handles`.

### Scope out

- Multi-select / marquee / align, floating FrameToolbar.
- Snapping during handle gestures (snap-wire / snapping-engine later).

### Delta / Risk

- Selected unlocked frame gets 8 resize handles, a rotate handle and a W × H mm tag; selected filled frames move by body drag. Observables: empty (no selection → no handles), happy (select → 8 handles + rotate; drag moves; corner resize stops at 5 mm), locked → outline only + status. Gesture previews are DOM writes; one BookOp per gesture. No new scrollport.
- Security: none (no file access, blob URL, worker surface).
