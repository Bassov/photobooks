# Lessons

Living journal of repeated review findings. Read before OpenSpec apply. Append one durable rule when a finding repeats; do not turn this into a checklist duplicate of `openspec/config.yaml`.

- Do not store `File` / `Blob` in persisted book or photo domain models — use ids; binary data stays in platform/store layers.
- Heavy image decode, render, and encode MUST run in Web Workers — never block the main thread.
- 60 fps is a product requirement: gate interactions on zero LoAF / handler p95 / INP (`src/perf/budgets.ts`); do not reintroduce a 200 ms LoAF allowance.
- Do not weaken `tsconfig` / ESLint, add blanket `eslint-disable` / `@ts-ignore` / `as any`, or skip tests to make checks green.
- Bugs found via exploratory browser or MCP sessions MUST be locked in with a Playwright test under `e2e/` that would have failed before the fix.
- Copy `input.files` into an array before setting `input.value = ''` — `FileList` is live and empties on clear.
- `useSyncExternalStore` getSnapshot return values must be referentially stable when data is unchanged (do not allocate a new object/array each call).
