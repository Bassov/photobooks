## Proposal

Roadmap: `docs/roadmap/P5/direct-crop-kit.md` (SoT). Designer Spec `walkthrough-ux-review` §A.

### Scope out

- `src/**` (core op and prod chrome are other items); `e2e/kit10-crop.spec.ts` drives prod, so it is unaffected.
- Filmstrip separator (Spec §B).

### Delta / Risk

- e2e: grabber painted at the photo centre, edge crop keeps the image rect, photo-corner scale, pinned Tab / arrows, small-frame hiding.
