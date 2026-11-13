## Proposal

Roadmap: `docs/roadmap/P4/site-share-flaky.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- The GL reader boot long task after load (its own perf item).
- `e2e/site-viewer.spec.ts` assertions (unchanged).

### Delta / Risk

- Delta: the 2 s "Copied" window starts at the paint, not the commit.
- UI: happy = click → "Copied" at the same width → "Share" after 2 s; interact = a second click restarts it; no empty state; no scrollport change.
