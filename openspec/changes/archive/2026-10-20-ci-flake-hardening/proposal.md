## Proposal

Roadmap: [`docs/roadmap/M2.1/ci-flake-hardening.md`](../../docs/roadmap/M2.1/ci-flake-hardening.md) (scope / Done when SoT). Prep fast-track; `skip_specs: true` (perf / seed skip + script isolation; filmstrip / frame-budget contracts unchanged).

### Scope out

- Looser `PERF_BUDGETS`, retries, or `@flaky` tags
- `bookStore` / `thumbCache` LoAF helpers (follow-up `reimport-loaf-store-thumb`)
- Live Codecov API unit coverage (mock/`fetchImpl` only)

### Delta / Risk

- KnownHash seed-only must still `memorySource.seedFile` so library source bytes stay available after re-import.
