## Proposal

Roadmap: `docs/roadmap/P4/print-model-pbt-timeout.md` (SoT).

### Scope out

- No change to the PBT arbitraries, numRuns or test timeout.
- No change to what `parseBook` accepts or rejects; `skip_specs: true`.

### Delta / Risk

- Delta: cache the schema built in `atParseTime` (`src/core/schema.ts`); `parseBook` gets faster, accepted inputs are unchanged.
- Risk: Stryker factory mutants may survive more often (attributed to the first parsing test per file).
