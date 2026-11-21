## Proposal

Roadmap: `docs/roadmap/P5/interface-size-kit-overlays.md` (scope / Done when / Browser). Design: Designer spec `interface-size` §4 + "Kit changes".

### Scope out

- Prod `src/**` (#672 / #674), kit demo steps and baselines, `qa.mjs`.
- Kit pointer math (IS6 is prod-only).

### Delta / Risk

- IS10: s = 1 renders unchanged; existing kit e2e and baselines lock it. e2e covers happy (125 % overlays anchored) and open / Escape; empty N/A. No spec delta.
