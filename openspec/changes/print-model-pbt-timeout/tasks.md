## Implementation

- [x] 1. Memoize the schema built by `atParseTime` in `src/core/schema.ts` (bench: `parseBook` 254–290 µs → 12–14 µs)
- [x] 2. Unit test: repeated parses through the cached cover shape stay independent (`src/core/schema.test.ts` "keeps each parse independent across repeated parses")

## Manual test scenarios

N/A — no UI; behavior is covered by unit + PBT.
