## Proposal

Roadmap: `docs/roadmap/P3/publish-site-flaky.md` (scope / Done when).

### Scope out

- Retrying a put already in flight when another fails.
- `checkConnection`, `r2Errors`, publish worker, editor publish UI.

### Delta / Risk

- Sliding window of 4: one slow put holds the next one in its slot. "Puts 4 at a time" is unchanged, so no spec delta.
