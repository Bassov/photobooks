## Proposal

Roadmap: [`docs/roadmap/P3/hosting-decision.md`](../../../docs/roadmap/P3/hosting-decision.md) (scope / Done when).

### Scope out

- No accounts, buckets, domains, tokens, `wrangler` deploys or paid plans: the host choice is an Owner decision (PLAN blocker class 3).
- No `src/`, `uikit/`, dependencies (`aws4fetch` is named, not added), UI or e2e.

### Delta / Risk

- Docs only: a comparison table + "Recommended (pending Owner confirmation)" host in `docs/future-architecture.md` `## Publishing`, with doc URLs checked on 2026-11-04.
- Security: the in-app publish credential model is recorded as a constraint; the publish change itself needs a Security Review.
