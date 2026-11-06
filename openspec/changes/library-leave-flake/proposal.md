## Proposal

Roadmap: [`docs/roadmap/P4/library-leave-flake.md`](../../../docs/roadmap/P4/library-leave-flake.md) (scope / Done when).

### Scope out

- No e2e spec edits (timeouts, retries, waits).
- No spec delta (`skip_specs: true`): ordering fix only.

### Delta / Risk

- Risk: a bind waiting on a hung restore stalls; restore awaits are IndexedDB reads, covered by unit + e2e repeat.
