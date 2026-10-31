## Proposal

Roadmap: `docs/roadmap/P1/fix-spread-gap-zoom.md` (scope SoT). UI ref: uikit#/demo.

### Scope out

- `uikit/` and `#/demo` untouched.
- Drop-zone hit-testing model unchanged (reads DOM rects).

### Delta / Risk

- Owner contract change: gap scales with the spread (was 44 screen px).
- Observables: empty = one-spread book has no gap; happy = gap/spread ratio constant at floor, Fit, zoomed in; interact = gap drop pill. No page-level H/V scroll; scrolling only inside `pasteboard-scroll`.
