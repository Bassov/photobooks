## Proposal

Roadmap: `docs/roadmap/P3/e2e-related-local.md` (scope / Done when SoT). Agent tooling only; no spec delta.

### Scope out

- CI burn-in / `e2e` job target selection (unchanged).
- Rig changes; this script is a local stopgap with a sunset note.

### Delta / Risk

- Local B gets slower on `src/` UI diffs (second Playwright build + ≤12 specs); the cap bounds it.
