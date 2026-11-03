## Proposal

Roadmap: `docs/roadmap/P2/tab-leaves-presentation.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Kit site `Fullscreen` lightbox (`site-viewer.tsx`).
- Inerting the editor chrome behind the dialog.

### Delta / Risk

- e2e observables: no empty state; happy = open presentation, focus inside; Tab / Shift+Tab ×10 stay inside; Esc → focus on Present. No scrollport change, no page-level scroll.
- Risk: an unmounted opener gets no focus back (restore skipped).
