## Proposal

Roadmap: `docs/roadmap/P3/uikit-qa-split-3.md` (scope / Done when); split map in `docs/roadmap/P3/uikit-qa-split-1.md`.

### Scope out

- Rows of other items (split-4…6) and qa.mjs sections 0–3.
- Any kit (`uikit/src/**`), product or Playwright config change.

### Delta / Risk

- Test-only move; no spec delta. Risk: a qa.mjs walk later depends on state a moved block set up — state-changing steps stay in qa.mjs, only reads and `ok()` move.
