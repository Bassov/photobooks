## Proposal

Roadmap: [`docs/roadmap/P3/publish-site-flaky-2.md`](../../../docs/roadmap/P3/publish-site-flaky-2.md) (scope / Done when SoT).

### Scope out

- Out-of-order refill; the #582 in-order window stays.
- Retry backoff and spec text unchanged.

### Delta / Risk

- Cause: signing awaited before `fetch`, so only 3 puts were in flight. Requests are signed up to 4 items ahead; SigV4 allows 15 min skew.
