## Decisions

1. Fix the product slow path rather than the test. Bench (vitest, 3-spread `makeBook`): migrate 0.1 µs, `structuredClone` 13 µs, `parseBook` 254–290 µs. Rebuilding the deferred shapes on every parse made up ~95 % of that time; Zod 4 also JIT-compiles each new object schema on its first parse. With the shapes cached, `parseBook` takes 12–14 µs.
2. `atParseTime(make)` keeps its lazy shape (build on first parse, inside a test, so Stryker still sees the factory mutants as non-static) and memoizes the built schema in its closure. Zod schemas are immutable and parse state lives per call, so sharing is safe. Rejected: `jitless` (only 2× faster), eager module-level schemas (mutants become static and are ignored), fewer runs or a smaller arbitrary (weakens the PBT).
3. The PBT files are unchanged. `sequence.pbt.test.ts` goes through `parseBook` too and gets faster for free.

## Touch-set & Test Plan

| File                      | Why                                                |
| ------------------------- | -------------------------------------------------- |
| `src/core/schema.ts`      | memoize the shape built in `atParseTime`           |
| `src/core/schema.test.ts` | repeated parses stay independent (valid/bad/valid) |

- Reuse: existing `atParseTime`, fixtures in `src/core/testing/fixtures`.
- Tests: unit (above); PBT `printModel.pbt.test.ts` and `ops/sequence.pbt.test.ts` unchanged as timing evidence. Strength check: an injected non-idempotent migrate (min/max trim swap on v11 docs) fails the idempotence property within 1–5 samples on 5 seeds. No e2e (no UI).
