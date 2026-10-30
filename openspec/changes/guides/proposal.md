## Proposal

Roadmap: `docs/roadmap/P2/guides.md` (scope / Browser / Perf SoT). UI ref: kit sandbox `viewport.tsx` `guideDrag`, `canvas.tsx` guide render.

### Scope out

- Parent / master (inherited) guides (`parent-guides`), guide locking UI, numeric guide entry.
- A separate "snap to guides" toggle: the shipped Snap toggle (Shift+S) already governs guide snapping.

### Delta / Risk

- Spread guides (`spread.guides`, already in the schema and in the snap index) gain add / move / remove ops; no schema change.
- UI: empty = no lines; happy = pull from either ruler, move, drop back on the ruler to delete; Ctrl+; and the TopBar Guides toggle hide them. No page-level H/V scroll; Preview never draws guides.
