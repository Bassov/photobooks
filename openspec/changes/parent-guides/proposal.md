## Proposal

Roadmap: [`docs/roadmap/P2/parent-guides.md`](../../../docs/roadmap/P2/parent-guides.md) (scope / Done when / Browser / Perf SoT); Designer spec PG1, PG2, PG4.

### Scope out

- Snapping to parent guides (PG3): next item `parent-guides-snap`; `frameGesture.ts` untouched.
- Kit (PG5, `parent-guides-kit`); override-copy UI; Masters canvas look.

### Delta / Risk

- UI: child spreads show parent guides dashed, pointer-transparent. Empty: a None spread shows none; happy: every Master A spread shows the line; interact: a press over a frame selects it. No scrollport change.
