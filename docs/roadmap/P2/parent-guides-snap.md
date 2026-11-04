# parent-guides-snap

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-guides-snap

## Scope

- [ ] Frame draw / move / resize (and the multi-select move union) snap to the parent (master) guides a spread shows (`viewGuides`), as to its own guides: anchor kind `guide`, same pull distance, same snap line + `snap · guide` pill (Designer spec parent-guides PG3)
- [ ] Hidden guides (Ctrl+;) never snap: no book, spread or parent guide anchors while guides are hidden; Snap off / Alt still disable all snapping (unchanged)
- [ ] Unit: `src/editor/frameGesture.test.ts` parent-guide snap case + hidden-guides-no-snap case (own and parent); the book-guide case stays green with guides visible
- **Browser check:** in `e2e/parent-spreads-guides.spec.ts`, a frame dragged near a master guide on a spread using that master snaps to it (DOM position, `snap · guide`); after Ctrl+; the same drag does not snap.
- **Perf:** snap targets are built once per gesture as today; no new per-move work.
- **PR body:** lists every caller of the snap-target path (grep) as fixed or left out with reason.
- **Test:** unit for the gesture; Playwright e2e on the `?fixture=` editor
- **Depends:** parent-guides
- **Owner-approved scope change:** 2026-11-04 the orchestrator brief (Designer design parent-guides READY 2026-11-04 03:43, PG3) defined this bug item's scope.
