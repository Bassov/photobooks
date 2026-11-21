## Proposal

Roadmap: `docs/roadmap/P5/interface-size-core.md` (scope / Done when / Browser SoT); Designer spec `interface-size` §2, §3.

### Scope out

- Settings → Interface UI (item `interface-size`).
- §4 overlays, pointer math, DPR consumers, Site preview counter-zoom (item `interface-size-overlays`); kit (item `interface-size-kit`).

### Delta / Risk

- At s > 1 popovers sit off until `interface-size-overlays` (no user path to s > 1 before item 4).
- Security: the stored value is whitelisted through a `Map`; anything else is 1.
